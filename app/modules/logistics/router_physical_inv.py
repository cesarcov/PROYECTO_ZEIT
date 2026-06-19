"""
Inventario Físico (Toma de Inventario)
Endpoints: /logistics/physical-inventory/*
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from app.core.database import db_connection
from app.core.security.permissions import require_permission

router = APIRouter(prefix="/logistics/physical-inventory", tags=["Inventario Físico"])


# ── Schemas ────────────────────────────────────────────────────
class InventoryCreate(BaseModel):
    warehouse_id: str
    title: str
    notes: Optional[str] = None

class ItemCount(BaseModel):
    item_id: str
    counted_quantity: float
    notes: Optional[str] = None


def _next_inv_number(cur) -> str:
    cur.execute("SELECT nextval('physical_inventory_seq')")
    seq = cur.fetchone()[0]
    year = datetime.utcnow().year
    return f"INV-{year}-{seq:04d}"


# ── Listar inventarios físicos ─────────────────────────────────
@router.get("")
def list_inventories(
    warehouse_id: Optional[str] = None,
    status: Optional[str] = None,
    _=Depends(require_permission("logistics:physical_inv:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pi.id, pi.inv_number, pi.title, pi.status,
                       pi.started_at, pi.closed_at, pi.approved_at,
                       w.name AS warehouse_name,
                       COUNT(pii.id) AS item_count
                FROM physical_inventories pi
                JOIN warehouses w ON w.id = pi.warehouse_id
                LEFT JOIN physical_inventory_items pii ON pii.inventory_id = pi.id
                WHERE (%s IS NULL OR pi.warehouse_id = %s::uuid)
                  AND (%s IS NULL OR pi.status = %s)
                GROUP BY pi.id, w.name
                ORDER BY pi.started_at DESC
            """, (warehouse_id, warehouse_id, status, status))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


# ── Abrir nuevo inventario físico ──────────────────────────────
@router.post("", status_code=201)
def open_inventory(
    body: InventoryCreate,
    user=Depends(require_permission("logistics:physical_inv:manage")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            # Verificar que no haya uno abierto para ese almacén
            cur.execute("""
                SELECT id FROM physical_inventories
                WHERE warehouse_id = %s::uuid AND status IN ('OPEN', 'COUNTING')
            """, (body.warehouse_id,))
            if cur.fetchone():
                raise HTTPException(400, "Ya hay un inventario abierto para este almacén")

            number = _next_inv_number(cur)
            cur.execute("""
                INSERT INTO physical_inventories
                    (inv_number, warehouse_id, title, notes, created_by)
                VALUES (%s, %s::uuid, %s, %s, %s::uuid)
                RETURNING id
            """, (number, body.warehouse_id, body.title, body.notes, user["id"]))
            inv_id = str(cur.fetchone()[0])

            # Pre-poblar con el stock actual del almacén
            cur.execute("""
                INSERT INTO physical_inventory_items
                    (inventory_id, material_id, system_quantity, unit_cost)
                SELECT
                    %s::uuid,
                    sm.material_id,
                    COALESCE(
                        SUM(CASE WHEN sm.to_warehouse = %s::uuid THEN sm.quantity ELSE 0 END) -
                        SUM(CASE WHEN sm.from_warehouse = %s::uuid THEN sm.quantity ELSE 0 END),
                        0
                    ) AS system_qty,
                    MAX(m.unit_cost) AS unit_cost
                FROM stock_movements sm
                JOIN materials m ON m.id = sm.material_id
                WHERE sm.to_warehouse = %s::uuid OR sm.from_warehouse = %s::uuid
                GROUP BY sm.material_id
                ON CONFLICT (inventory_id, material_id) DO NOTHING
            """, (inv_id, body.warehouse_id, body.warehouse_id,
                  body.warehouse_id, body.warehouse_id))

        conn.commit()
    return {"id": inv_id, "inv_number": number}


# ── Detalle del inventario + sus ítems ────────────────────────
@router.get("/{inv_id}")
def get_inventory(
    inv_id: str,
    _=Depends(require_permission("logistics:physical_inv:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pi.*, w.name AS warehouse_name
                FROM physical_inventories pi
                JOIN warehouses w ON w.id = pi.warehouse_id
                WHERE pi.id = %s::uuid
            """, (inv_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Inventario no encontrado")
            cols = [d[0] for d in cur.description]
            inv = dict(zip(cols, row))

            cur.execute("""
                SELECT
                    pii.id, pii.system_quantity, pii.counted_quantity,
                    (pii.counted_quantity - pii.system_quantity) AS difference,
                    pii.unit_cost,
                    (pii.counted_quantity - pii.system_quantity) * pii.unit_cost AS value_difference,
                    pii.adjusted, pii.notes, pii.counted_at,
                    m.id AS material_id, m.code, m.name AS material_name, m.unit
                FROM physical_inventory_items pii
                JOIN materials m ON m.id = pii.material_id
                WHERE pii.inventory_id = %s::uuid
                ORDER BY m.name
            """, (inv_id,))
            item_cols = [d[0] for d in cur.description]
            inv["items"] = [dict(zip(item_cols, r)) for r in cur.fetchall()]
    return inv


# ── Registrar conteo de un ítem ────────────────────────────────
@router.patch("/{inv_id}/items/count")
def register_count(
    inv_id: str,
    body: ItemCount,
    user=Depends(require_permission("logistics:physical_inv:manage")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM physical_inventories WHERE id = %s::uuid",
                (inv_id,)
            )
            inv = cur.fetchone()
            if not inv:
                raise HTTPException(404, "Inventario no encontrado")
            if inv[0] not in ("OPEN", "COUNTING"):
                raise HTTPException(400, f"No se puede contar en estado '{inv[0]}'")

            cur.execute("""
                UPDATE physical_inventory_items
                SET counted_quantity = %s, notes = %s,
                    counted_by = %s::uuid, counted_at = NOW()
                WHERE id = %s::uuid AND inventory_id = %s::uuid
            """, (body.counted_quantity, body.notes, user["id"], body.item_id, inv_id))

            # Marcar el inventario como COUNTING si aún está OPEN
            cur.execute("""
                UPDATE physical_inventories SET status = 'COUNTING'
                WHERE id = %s::uuid AND status = 'OPEN'
            """, (inv_id,))
        conn.commit()
    return {"ok": True}


# ── Cerrar inventario (freeze) ─────────────────────────────────
@router.post("/{inv_id}/close")
def close_inventory(
    inv_id: str,
    _=Depends(require_permission("logistics:physical_inv:manage")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM physical_inventories WHERE id = %s::uuid",
                (inv_id,)
            )
            inv = cur.fetchone()
            if not inv or inv[0] not in ("OPEN", "COUNTING"):
                raise HTTPException(400, "Solo se puede cerrar un inventario OPEN o COUNTING")

            cur.execute("""
                UPDATE physical_inventories
                SET status = 'CLOSED', closed_at = NOW()
                WHERE id = %s::uuid
            """, (inv_id,))
        conn.commit()
    return {"ok": True}


# ── Aprobar y aplicar ajustes al stock ────────────────────────
@router.post("/{inv_id}/approve")
def approve_inventory(
    inv_id: str,
    user=Depends(require_permission("logistics:physical_inv:manage")),
):
    """Aprueba el inventario y genera movimientos ADJUST en stock_movements
    para las diferencias encontradas."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT pi.status, pi.warehouse_id
                FROM physical_inventories pi WHERE pi.id = %s::uuid
            """, (inv_id,))
            inv = cur.fetchone()
            if not inv or inv[0] != "CLOSED":
                raise HTTPException(400, "Solo se puede aprobar un inventario CLOSED")

            warehouse_id = str(inv[1])

            # Obtener ítems con diferencia y no ajustados
            cur.execute("""
                SELECT id, material_id, system_quantity, counted_quantity, unit_cost
                FROM physical_inventory_items
                WHERE inventory_id = %s::uuid
                  AND counted_quantity IS NOT NULL
                  AND counted_quantity <> system_quantity
                  AND adjusted = FALSE
            """, (inv_id,))
            items = cur.fetchall()

            for item_id, mat_id, sys_qty, cnt_qty, unit_cost in items:
                diff = float(cnt_qty) - float(sys_qty)
                mv_type = "ADJUST"
                qty = abs(diff)

                if diff > 0:
                    cur.execute("""
                        INSERT INTO stock_movements
                            (material_id, movement_type, quantity, to_warehouse,
                             unit_cost, reference, notes, created_by)
                        VALUES (%s::uuid, %s, %s, %s::uuid,
                                %s, %s, 'Ajuste por inventario físico', %s::uuid)
                    """, (str(mat_id), mv_type, qty, warehouse_id,
                          float(unit_cost or 0),
                          f"INV-ADJ-{inv_id[:8]}", str(user["id"])))
                else:
                    cur.execute("""
                        INSERT INTO stock_movements
                            (material_id, movement_type, quantity, from_warehouse,
                             unit_cost, reference, notes, created_by)
                        VALUES (%s::uuid, %s, %s, %s::uuid,
                                %s, %s, 'Ajuste por inventario físico', %s::uuid)
                    """, (str(mat_id), mv_type, qty, warehouse_id,
                          float(unit_cost or 0),
                          f"INV-ADJ-{inv_id[:8]}", str(user["id"])))

                cur.execute("""
                    UPDATE physical_inventory_items SET adjusted = TRUE
                    WHERE id = %s
                """, (item_id,))

            # Aprobar inventario
            cur.execute("""
                UPDATE physical_inventories
                SET status = 'APPROVED', approved_by = %s::uuid, approved_at = NOW()
                WHERE id = %s::uuid
            """, (user["id"], inv_id))
        conn.commit()
    return {"ok": True, "adjustments_applied": len(items)}
