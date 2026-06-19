"""
Transferencias entre Almacenes
Endpoints: /logistics/transfers/*
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.core.database import db_connection
from app.core.security.permissions import require_permission

router = APIRouter(prefix="/logistics/transfers", tags=["Transferencias"])


# ── Schemas ────────────────────────────────────────────────────
class TransferItemIn(BaseModel):
    material_id: str
    quantity_requested: float
    notes: Optional[str] = None

class TransferCreate(BaseModel):
    from_warehouse_id: str
    to_warehouse_id: str
    notes: Optional[str] = None
    items: List[TransferItemIn]

class TransferStatusUpdate(BaseModel):
    status: str          # APPROVED, IN_TRANSIT, RECEIVED, CANCELLED
    notes: Optional[str] = None

class ReceiveItemUpdate(BaseModel):
    item_id: str
    quantity_received: float


def _next_transfer_number(cur) -> str:
    cur.execute("SELECT nextval('warehouse_transfer_seq')")
    seq = cur.fetchone()[0]
    year = datetime.utcnow().year
    return f"TRF-{year}-{seq:04d}"


# ── Listar transferencias ──────────────────────────────────────
@router.get("")
def list_transfers(
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    _=Depends(require_permission("logistics:transfers:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    wt.id, wt.transfer_number, wt.status, wt.notes,
                    wt.requested_at, wt.approved_at, wt.received_at,
                    fw.name AS from_warehouse, tw.name AS to_warehouse,
                    COUNT(wti.id) AS item_count
                FROM warehouse_transfers wt
                JOIN warehouses fw ON fw.id = wt.from_warehouse_id
                JOIN warehouses tw ON tw.id = wt.to_warehouse_id
                LEFT JOIN warehouse_transfer_items wti ON wti.transfer_id = wt.id
                WHERE (%s IS NULL OR wt.status = %s)
                  AND (%s IS NULL OR (wt.from_warehouse_id = %s::uuid OR wt.to_warehouse_id = %s::uuid))
                GROUP BY wt.id, fw.name, tw.name
                ORDER BY wt.requested_at DESC
            """, (status, status, warehouse_id, warehouse_id, warehouse_id))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


# ── Detalle de una transferencia ───────────────────────────────
@router.get("/{transfer_id}")
def get_transfer(
    transfer_id: str,
    _=Depends(require_permission("logistics:transfers:view")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    wt.*,
                    fw.name AS from_warehouse_name,
                    tw.name AS to_warehouse_name
                FROM warehouse_transfers wt
                JOIN warehouses fw ON fw.id = wt.from_warehouse_id
                JOIN warehouses tw ON tw.id = wt.to_warehouse_id
                WHERE wt.id = %s::uuid
            """, (transfer_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Transferencia no encontrada")
            cols = [d[0] for d in cur.description]
            transfer = dict(zip(cols, row))

            cur.execute("""
                SELECT wti.*, m.code AS material_code, m.name AS material_name, m.unit
                FROM warehouse_transfer_items wti
                JOIN materials m ON m.id = wti.material_id
                WHERE wti.transfer_id = %s::uuid
            """, (transfer_id,))
            item_cols = [d[0] for d in cur.description]
            transfer["items"] = [dict(zip(item_cols, r)) for r in cur.fetchall()]
    return transfer


# ── Crear transferencia ────────────────────────────────────────
@router.post("", status_code=201)
def create_transfer(
    body: TransferCreate,
    user=Depends(require_permission("logistics:transfers:manage")),
):
    if body.from_warehouse_id == body.to_warehouse_id:
        raise HTTPException(400, "El almacén origen y destino deben ser distintos")
    if not body.items:
        raise HTTPException(400, "Debe incluir al menos un ítem")

    with db_connection() as conn:
        with conn.cursor() as cur:
            number = _next_transfer_number(cur)
            cur.execute("""
                INSERT INTO warehouse_transfers
                    (transfer_number, from_warehouse_id, to_warehouse_id, notes, requested_by)
                VALUES (%s, %s::uuid, %s::uuid, %s, %s::uuid)
                RETURNING id
            """, (number, body.from_warehouse_id, body.to_warehouse_id,
                  body.notes, user["id"]))
            transfer_id = str(cur.fetchone()[0])

            for item in body.items:
                cur.execute("""
                    INSERT INTO warehouse_transfer_items
                        (transfer_id, material_id, quantity_requested, notes)
                    VALUES (%s::uuid, %s::uuid, %s, %s)
                """, (transfer_id, item.material_id, item.quantity_requested, item.notes))
        conn.commit()
    return {"id": transfer_id, "transfer_number": number}


# ── Cambiar estado: APPROVED / IN_TRANSIT / CANCELLED ─────────
@router.patch("/{transfer_id}/status")
def update_transfer_status(
    transfer_id: str,
    body: TransferStatusUpdate,
    user=Depends(require_permission("logistics:transfers:manage")),
):
    valid = {"APPROVED", "IN_TRANSIT", "CANCELLED"}
    if body.status not in valid:
        raise HTTPException(400, f"Estado no válido. Usa: {valid}")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT status FROM warehouse_transfers WHERE id = %s::uuid",
                (transfer_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Transferencia no encontrada")

            extra_col = ""
            if body.status == "APPROVED":
                extra_col = ", approved_by = %s::uuid, approved_at = NOW()"
                cur.execute(
                    f"UPDATE warehouse_transfers SET status = %s {extra_col} WHERE id = %s::uuid",
                    (body.status, user["id"], transfer_id)
                )
            else:
                cur.execute(
                    "UPDATE warehouse_transfers SET status = %s WHERE id = %s::uuid",
                    (body.status, transfer_id)
                )
        conn.commit()
    return {"ok": True}


# ── Registrar recepción (mueve stock físicamente) ──────────────
@router.post("/{transfer_id}/receive")
def receive_transfer(
    transfer_id: str,
    items: List[ReceiveItemUpdate],
    user=Depends(require_permission("logistics:transfers:manage")),
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT from_warehouse_id, to_warehouse_id, status
                FROM warehouse_transfers WHERE id = %s::uuid
            """, (transfer_id,))
            transfer = cur.fetchone()
            if not transfer:
                raise HTTPException(404, "Transferencia no encontrada")
            if transfer[2] not in ("APPROVED", "IN_TRANSIT"):
                raise HTTPException(400, f"No se puede recibir una transferencia en estado '{transfer[2]}'")

            from_wh, to_wh = str(transfer[0]), str(transfer[1])

            for item in items:
                cur.execute("""
                    UPDATE warehouse_transfer_items
                    SET quantity_received = %s
                    WHERE id = %s::uuid AND transfer_id = %s::uuid
                """, (item.quantity_received, item.item_id, transfer_id))

                # Obtener material_id del ítem
                cur.execute(
                    "SELECT material_id FROM warehouse_transfer_items WHERE id = %s::uuid",
                    (item.item_id,)
                )
                mat_row = cur.fetchone()
                if not mat_row:
                    continue
                material_id = str(mat_row[0])

                # Movimiento de salida del origen
                cur.execute("""
                    INSERT INTO stock_movements
                        (material_id, movement_type, quantity, from_warehouse, to_warehouse,
                         reference, created_by)
                    VALUES (%s::uuid, 'TRANSFER', %s, %s::uuid, %s::uuid,
                            %s, %s)
                """, (
                    material_id, item.quantity_received,
                    from_wh, to_wh,
                    f"TRF-{transfer_id[:8]}",
                    str(user["id"]),
                ))

            # Marcar como RECEIVED
            cur.execute("""
                UPDATE warehouse_transfers
                SET status = 'RECEIVED', received_by = %s::uuid, received_at = NOW()
                WHERE id = %s::uuid
            """, (user["id"], transfer_id))
        conn.commit()
    return {"ok": True, "message": "Transferencia recibida y stock actualizado"}
