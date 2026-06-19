"""
Funcionalidades avanzadas de Logística:
  · Kardex con costo unitario y valor total
  · Valorización de inventario (costo promedio ponderado)
  · Punto de reposición / alertas de reposición
  · Códigos QR (generar imagen PNG)
Endpoints: /logistics/advanced/*
"""
import io
import qrcode
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.core.database import db_connection
from app.core.security.permissions import require_permission

router = APIRouter(prefix="/logistics/advanced", tags=["Avanzado"])


# ══════════════════════════════════════════════════════════════
# KARDEX CON COSTO
# ══════════════════════════════════════════════════════════════

@router.get("/kardex/{material_id}")
def kardex_with_cost(
    material_id: str,
    warehouse_id: Optional[str] = None,
    limit: int = Query(200, le=1000),
    _=Depends(require_permission("logistics:stock:view")),
):
    """
    Kardex completo: muestra cantidad, costo unitario, valor del movimiento
    y saldo acumulado en valor para un material dado.
    """
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sm.id,
                    sm.movement_type,
                    sm.quantity,
                    COALESCE(sm.unit_cost, m.unit_cost, 0)  AS unit_cost,
                    sm.quantity * COALESCE(sm.unit_cost, m.unit_cost, 0) AS line_value,
                    sm.reference,
                    sm.notes,
                    sm.created_at,
                    fw.name AS from_warehouse,
                    tw.name AS to_warehouse,
                    sm.lot_id
                FROM stock_movements sm
                JOIN materials m ON m.id = sm.material_id
                LEFT JOIN warehouses fw ON fw.id = sm.from_warehouse
                LEFT JOIN warehouses tw ON tw.id = sm.to_warehouse
                WHERE sm.material_id = %s::uuid
                  AND (%s IS NULL OR sm.from_warehouse = %s::uuid OR sm.to_warehouse = %s::uuid)
                ORDER BY sm.created_at ASC
                LIMIT %s
            """, (material_id, warehouse_id, warehouse_id, warehouse_id, limit))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]

            cur.execute(
                "SELECT id, code, name, unit, unit_cost, weighted_avg_cost FROM materials WHERE id = %s::uuid",
                (material_id,)
            )
            mat = cur.fetchone()
            if not mat:
                raise HTTPException(404, "Material no encontrado")

    # Calcular saldo acumulado en cantidad y valor
    movements = []
    running_qty   = 0.0
    running_value = 0.0
    for r in rows:
        row = dict(zip(cols, r))
        mv = row["movement_type"]
        qty = float(row["quantity"])
        val = float(row["line_value"])

        if mv in ("IN", "RETURN", "ADJUST") and row["from_warehouse"] is None:
            running_qty   += qty
            running_value += val
            sign = "+"
        elif mv in ("OUT", "ADJUST") and row["to_warehouse"] is None:
            running_qty   -= qty
            running_value -= val
            sign = "−"
        else:
            sign = "→"   # TRANSFER — neutro en el saldo

        row["running_quantity"] = round(running_qty, 4)
        row["running_value"]    = round(running_value, 4)
        row["sign"]             = sign
        movements.append(row)

    return {
        "material": {
            "id": str(mat[0]), "code": mat[1], "name": mat[2],
            "unit": mat[3], "unit_cost": float(mat[4] or 0),
            "weighted_avg_cost": float(mat[5] or 0),
        },
        "movements": movements,
        "total_quantity": round(running_qty, 4),
        "total_value": round(running_value, 4),
    }


# ══════════════════════════════════════════════════════════════
# VALORIZACIÓN DE INVENTARIO (Costo Promedio Ponderado)
# ══════════════════════════════════════════════════════════════

@router.get("/valuation")
def inventory_valuation(
    warehouse_id: Optional[str] = None,
    _=Depends(require_permission("logistics:valuation:view")),
):
    """
    Retorna el inventario valorizado: stock actual × costo promedio ponderado.
    Recalcula el CPP en tiempo real a partir de los movimientos de entrada con costo.
    """
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH entradas AS (
                    -- Costo promedio ponderado: promedio de entradas con costo > 0
                    SELECT
                        sm.material_id,
                        CASE
                            WHEN SUM(CASE WHEN sm.unit_cost > 0 THEN sm.quantity ELSE 0 END) > 0
                            THEN SUM(CASE WHEN sm.unit_cost > 0 THEN sm.quantity * sm.unit_cost ELSE 0 END)
                               / SUM(CASE WHEN sm.unit_cost > 0 THEN sm.quantity ELSE 0 END)
                            ELSE MAX(m.unit_cost)
                        END AS weighted_avg_cost
                    FROM stock_movements sm
                    JOIN materials m ON m.id = sm.material_id
                    WHERE sm.movement_type IN ('IN', 'RETURN')
                    GROUP BY sm.material_id
                ),
                stock_actual AS (
                    SELECT
                        sm.material_id,
                        sm.to_warehouse   AS warehouse_id,
                        SUM(CASE WHEN sm.to_warehouse IS NOT NULL AND sm.movement_type IN ('IN','RETURN','TRANSFER','ADJUST')
                                 THEN sm.quantity ELSE 0 END) -
                        SUM(CASE WHEN sm.from_warehouse IS NOT NULL AND sm.movement_type IN ('OUT','TRANSFER','ADJUST')
                                 THEN sm.quantity ELSE 0 END) AS qty
                    FROM stock_movements sm
                    WHERE %s IS NULL OR sm.to_warehouse = %s::uuid OR sm.from_warehouse = %s::uuid
                    GROUP BY sm.material_id, sm.to_warehouse
                )
                SELECT
                    m.id, m.code, m.name, m.unit, m.category,
                    w.name AS warehouse_name,
                    COALESCE(sa.qty, 0)                             AS current_stock,
                    COALESCE(e.weighted_avg_cost, m.unit_cost, 0)  AS weighted_avg_cost,
                    COALESCE(sa.qty, 0) *
                        COALESCE(e.weighted_avg_cost, m.unit_cost, 0) AS total_value
                FROM materials m
                JOIN stock_actual sa ON sa.material_id = m.id
                LEFT JOIN warehouses w ON w.id = sa.warehouse_id
                LEFT JOIN entradas e ON e.material_id = m.id
                WHERE COALESCE(sa.qty, 0) > 0
                ORDER BY total_value DESC
            """, (warehouse_id, warehouse_id, warehouse_id))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]

            # Total general
            cur.execute("""
                SELECT COALESCE(SUM(
                    COALESCE(stock.qty, 0) *
                    COALESCE(e.weighted_avg_cost, m.unit_cost, 0)
                ), 0)
                FROM materials m
                JOIN (
                    SELECT material_id,
                        SUM(CASE WHEN to_warehouse IS NOT NULL THEN quantity ELSE 0 END) -
                        SUM(CASE WHEN from_warehouse IS NOT NULL THEN quantity ELSE 0 END) AS qty
                    FROM stock_movements GROUP BY material_id
                ) stock ON stock.material_id = m.id
                LEFT JOIN (
                    SELECT material_id,
                        SUM(CASE WHEN unit_cost > 0 THEN quantity * unit_cost ELSE 0 END) /
                        NULLIF(SUM(CASE WHEN unit_cost > 0 THEN quantity ELSE 0 END), 0)
                        AS weighted_avg_cost
                    FROM stock_movements WHERE movement_type IN ('IN','RETURN')
                    GROUP BY material_id
                ) e ON e.material_id = m.id
                WHERE stock.qty > 0
            """)
            total_row = cur.fetchone()

    return {
        "total_value": float(total_row[0]) if total_row else 0,
        "items": [dict(zip(cols, r)) for r in rows],
    }


# ══════════════════════════════════════════════════════════════
# PUNTO DE REPOSICIÓN / ALERTAS DE REPOSICIÓN
# ══════════════════════════════════════════════════════════════

@router.get("/reorder-alerts")
def reorder_alerts(
    warehouse_id: Optional[str] = None,
    _=Depends(require_permission("logistics:stock:view")),
):
    """
    Materiales cuyo stock actual está en o por debajo del punto de reposición.
    Incluye sugerencia de cantidad a comprar (hasta llegar al stock máximo).
    """
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH stock_actual AS (
                    SELECT
                        material_id,
                        SUM(CASE WHEN to_warehouse IS NOT NULL   THEN quantity ELSE 0 END) -
                        SUM(CASE WHEN from_warehouse IS NOT NULL THEN quantity ELSE 0 END) AS qty
                    FROM stock_movements
                    WHERE %s IS NULL OR to_warehouse = %s::uuid OR from_warehouse = %s::uuid
                    GROUP BY material_id
                )
                SELECT
                    m.id, m.code, m.name, m.unit, m.category,
                    m.min_stock, m.reorder_point, m.max_stock,
                    m.supplier_name,
                    COALESCE(m.weighted_avg_cost, m.unit_cost, 0) AS unit_cost,
                    COALESCE(sa.qty, 0)  AS current_stock,
                    GREATEST(0, COALESCE(m.max_stock, m.min_stock * 2, 0) - COALESCE(sa.qty, 0))
                        AS suggested_order_qty,
                    CASE
                        WHEN COALESCE(sa.qty, 0) <= 0               THEN 'CRITICAL'
                        WHEN COALESCE(sa.qty, 0) <= m.min_stock     THEN 'CRITICAL'
                        WHEN COALESCE(sa.qty, 0) <= m.reorder_point THEN 'LOW'
                        ELSE 'OK'
                    END AS alert_level
                FROM materials m
                LEFT JOIN stock_actual sa ON sa.material_id = m.id
                WHERE m.reorder_point > 0
                  AND COALESCE(sa.qty, 0) <= m.reorder_point
                ORDER BY
                    CASE WHEN COALESCE(sa.qty, 0) <= m.min_stock THEN 0 ELSE 1 END ASC,
                    current_stock ASC
            """, (warehouse_id, warehouse_id, warehouse_id))
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description]
    return [dict(zip(cols, r)) for r in rows]


@router.patch("/materials/{material_id}/reorder-config")
def update_reorder_config(
    material_id: str,
    min_stock: Optional[float] = None,
    max_stock: Optional[float] = None,
    reorder_point: Optional[float] = None,
    _=Depends(require_permission("logistics:stock:move")),
):
    """Configura el punto de reposición, stock mínimo y stock máximo de un material."""
    updates = []
    values = []
    if min_stock is not None:
        updates.append("min_stock = %s")
        values.append(min_stock)
    if max_stock is not None:
        updates.append("max_stock = %s")
        values.append(max_stock)
    if reorder_point is not None:
        updates.append("reorder_point = %s")
        values.append(reorder_point)
    if not updates:
        raise HTTPException(400, "No hay valores para actualizar")

    values.append(material_id)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE materials SET {', '.join(updates)} WHERE id = %s::uuid",
                values
            )
        conn.commit()
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
# CÓDIGO QR — generar imagen PNG
# ══════════════════════════════════════════════════════════════

@router.get("/qr/material/{material_id}")
def generate_material_qr(
    material_id: str,
    _=Depends(require_permission("logistics:stock:view")),
):
    """Genera una imagen QR PNG con el código único del material."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT code, name, qr_code FROM materials WHERE id = %s::uuid",
                (material_id,)
            )
            mat = cur.fetchone()
            if not mat:
                raise HTTPException(404, "Material no encontrado")
            qr_data = mat[2] or mat[0]

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0B2E33", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    filename = f"QR_{mat[0]}.png"
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/qr/lot/{lot_id}")
def generate_lot_qr(
    lot_id: str,
    _=Depends(require_permission("logistics:lots:view")),
):
    """Genera una imagen QR PNG con el código único del lote."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT sl.lot_number, sl.qr_code, m.code AS material_code, m.name
                FROM stock_lots sl
                JOIN materials m ON m.id = sl.material_id
                WHERE sl.id = %s::uuid
            """, (lot_id,))
            lot = cur.fetchone()
            if not lot:
                raise HTTPException(404, "Lote no encontrado")
            qr_data = lot[1] or f"{lot[2]}-{lot[0]}"

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(qr_data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0B2E33", back_color="white")

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)

    filename = f"QR_LOT_{lot[0]}.png"
    return StreamingResponse(
        buf,
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
