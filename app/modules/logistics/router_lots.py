"""
Trazabilidad por Lote
Endpoints: /logistics/lots/*
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import date
from app.core.database import db_connection
from app.core.security.dependencies import get_current_user
from app.core.security.permissions import require_permission

router = APIRouter(prefix="/logistics/lots", tags=["Lotes"])


# ── Schemas ────────────────────────────────────────────────────
class LotCreate(BaseModel):
    material_id: str
    lot_number: str
    warehouse_id: Optional[str] = None
    quantity: float
    unit_cost: float = 0.0
    expiry_date: Optional[date] = None
    manufacture_date: Optional[date] = None
    supplier_name: Optional[str] = None
    notes: Optional[str] = None

class LotMovementCreate(BaseModel):
    lot_id: str
    movement_type: str       # IN, OUT, ADJUST
    quantity: float
    notes: Optional[str] = None


# ── Listar lotes (con filtros opcionales) ──────────────────────
@router.get("")
def list_lots(
    material_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    status: Optional[str] = None,
    _=Depends(require_permission("logistics:lots:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sl.id, sl.lot_number, sl.status,
                    sl.quantity, sl.remaining_quantity, sl.unit_cost,
                    sl.expiry_date, sl.manufacture_date,
                    sl.supplier_name, sl.notes, sl.qr_code,
                    sl.created_at,
                    m.id AS material_id, m.code AS material_code, m.name AS material_name, m.unit,
                    w.id AS warehouse_id, w.name AS warehouse_name
                FROM stock_lots sl
                JOIN materials m ON m.id = sl.material_id
                LEFT JOIN warehouses w ON w.id = sl.warehouse_id
                WHERE (%s IS NULL OR sl.material_id = %s::uuid)
                  AND (%s IS NULL OR sl.warehouse_id = %s::uuid)
                  AND (%s IS NULL OR sl.status = %s)
                ORDER BY sl.created_at DESC
            """, (material_id, material_id, warehouse_id, warehouse_id, status, status))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


# ── Detalle de un lote ─────────────────────────────────────────
@router.get("/{lot_id}")
def get_lot(
    lot_id: str,
    _=Depends(require_permission("logistics:lots:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sl.*, m.code AS material_code, m.name AS material_name, m.unit,
                    w.name AS warehouse_name
                FROM stock_lots sl
                JOIN materials m ON m.id = sl.material_id
                LEFT JOIN warehouses w ON w.id = sl.warehouse_id
                WHERE sl.id = %s::uuid
            """, (lot_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Lote no encontrado")
            cols = [d[0] for d in cur.description]

            # Movimientos del lote
            cur.execute("""
                SELECT id, quantity, movement_type, notes, created_at
                FROM stock_lot_movements
                WHERE lot_id = %s::uuid
                ORDER BY created_at DESC
            """, (lot_id,))
            mov_rows = cur.fetchall()
            mov_cols = [d[0] for d in cur.description]

    lot = dict(zip(cols, row))
    lot["movements"] = [dict(zip(mov_cols, r)) for r in mov_rows]
    return lot


# ── Crear lote ─────────────────────────────────────────────────
@router.post("", status_code=201)
def create_lot(
    body: LotCreate,
    user=Depends(require_permission("logistics:lots:manage")),
):
    # Generar qr_code basado en material_code + lot_number
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT code FROM materials WHERE id = %s::uuid", (body.material_id,))
            mat = cur.fetchone()
            if not mat:
                raise HTTPException(404, "Material no encontrado")
            qr_code = f"{mat[0]}-LOT-{body.lot_number}"

            cur.execute("""
                INSERT INTO stock_lots
                    (material_id, lot_number, warehouse_id, quantity, remaining_quantity,
                     unit_cost, expiry_date, manufacture_date, supplier_name, notes, qr_code, created_by)
                VALUES
                    (%s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::uuid)
                RETURNING id
            """, (
                body.material_id, body.lot_number,
                body.warehouse_id or None,
                body.quantity, body.quantity,
                body.unit_cost,
                body.expiry_date, body.manufacture_date,
                body.supplier_name, body.notes,
                qr_code,
                user["id"],
            ))
            lot_id = cur.fetchone()[0]

            # Registrar movimiento inicial
            cur.execute("""
                INSERT INTO stock_lot_movements (lot_id, quantity, movement_type, notes)
                VALUES (%s, %s, 'IN', 'Creación de lote')
            """, (str(lot_id), body.quantity))

        conn.commit()
    return {"id": str(lot_id), "qr_code": qr_code}


# ── Registrar movimiento de salida en un lote ──────────────────
@router.post("/{lot_id}/movements", status_code=201)
def add_lot_movement(
    lot_id: str,
    body: LotMovementCreate,
    user=Depends(require_permission("logistics:lots:manage")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT remaining_quantity FROM stock_lots WHERE id = %s::uuid",
                (lot_id,)
            )
            lot = cur.fetchone()
            if not lot:
                raise HTTPException(404, "Lote no encontrado")

            if body.movement_type == "OUT" and lot[0] < body.quantity:
                raise HTTPException(400, f"Stock insuficiente en lote. Disponible: {lot[0]}")

            delta = body.quantity if body.movement_type == "IN" else -body.quantity
            cur.execute("""
                UPDATE stock_lots
                SET remaining_quantity = remaining_quantity + %s
                WHERE id = %s::uuid
            """, (delta, lot_id))

            cur.execute("""
                INSERT INTO stock_lot_movements (lot_id, quantity, movement_type, notes)
                VALUES (%s::uuid, %s, %s, %s)
            """, (lot_id, body.quantity, body.movement_type, body.notes))

            # Marcar como DEPLETED si agota
            cur.execute("""
                UPDATE stock_lots SET status = 'DEPLETED'
                WHERE id = %s::uuid AND remaining_quantity <= 0
            """, (lot_id,))

        conn.commit()
    return {"ok": True}


# ── Alertas de lotes por vencer (próximos 30 días) ────────────
@router.get("/alerts/expiring")
def expiring_lots(
    days: int = 30,
    _=Depends(require_permission("logistics:lots:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sl.id, sl.lot_number, sl.expiry_date, sl.remaining_quantity,
                    sl.status, m.code, m.name AS material_name, w.name AS warehouse_name,
                    (sl.expiry_date - CURRENT_DATE) AS days_until_expiry
                FROM stock_lots sl
                JOIN materials m ON m.id = sl.material_id
                LEFT JOIN warehouses w ON w.id = sl.warehouse_id
                WHERE sl.expiry_date IS NOT NULL
                  AND sl.expiry_date <= CURRENT_DATE + (%s || ' days')::interval
                  AND sl.status = 'ACTIVE'
                  AND sl.remaining_quantity > 0
                ORDER BY sl.expiry_date ASC
            """, (str(days),))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]
