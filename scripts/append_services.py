"""Append calibration and purchase services to service.py"""
import os

NEW_CODE = '''

# ============================================================
# CALIBRATION RECORDS
# ============================================================

def get_calibration_alerts():
    """Materials with calibration_required=True expiring within 30 days or no record."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH latest AS (
                    SELECT DISTINCT ON (material_id)
                        material_id, calibrated_at, expires_at,
                        certificate_url, technician, notes, id AS record_id
                    FROM calibration_records
                    ORDER BY material_id, expires_at DESC
                )
                SELECT
                    m.id, m.code, m.name, m.category,
                    m.calibration_interval_days,
                    l.calibrated_at, l.expires_at, l.certificate_url,
                    l.technician, l.notes, l.record_id,
                    (l.expires_at - CURRENT_DATE) AS days_left
                FROM materials m
                LEFT JOIN latest l ON l.material_id = m.id
                WHERE m.calibration_required = TRUE
                  AND (l.expires_at IS NULL OR l.expires_at <= CURRENT_DATE + INTERVAL '30 days')
                ORDER BY COALESCE(l.expires_at, '1900-01-01'::date) ASC
            """)
            rows = cur.fetchall()
    return [
        {
            "material_id":     str(r[0]),
            "material_code":   r[1],
            "material_name":   r[2],
            "category":        r[3],
            "interval_days":   r[4],
            "calibrated_at":   r[5].isoformat() if r[5] else None,
            "expires_at":      r[6].isoformat() if r[6] else None,
            "certificate_url": r[7],
            "technician":      r[8],
            "notes":           r[9],
            "last_record_id":  str(r[10]) if r[10] else None,
            "days_left":       int(r[11]) if r[11] is not None else None,
        }
        for r in rows
    ]


def get_all_calibrations_list():
    """All calibration-required materials with their latest calibration status."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                WITH latest AS (
                    SELECT DISTINCT ON (material_id)
                        material_id, calibrated_at, expires_at,
                        certificate_url, technician, id AS record_id
                    FROM calibration_records
                    ORDER BY material_id, expires_at DESC
                )
                SELECT
                    m.id, m.code, m.name, m.category,
                    m.calibration_interval_days,
                    l.calibrated_at, l.expires_at, l.certificate_url,
                    l.technician, l.record_id,
                    (l.expires_at - CURRENT_DATE) AS days_left
                FROM materials m
                LEFT JOIN latest l ON l.material_id = m.id
                WHERE m.calibration_required = TRUE
                ORDER BY COALESCE(l.expires_at, '1900-01-01'::date) ASC
            """)
            rows = cur.fetchall()
    return [
        {
            "material_id":     str(r[0]),
            "material_code":   r[1],
            "material_name":   r[2],
            "category":        r[3],
            "interval_days":   r[4],
            "calibrated_at":   r[5].isoformat() if r[5] else None,
            "expires_at":      r[6].isoformat() if r[6] else None,
            "certificate_url": r[7],
            "technician":      r[8],
            "last_record_id":  str(r[9]) if r[9] else None,
            "days_left":       int(r[10]) if r[10] is not None else None,
        }
        for r in rows
    ]


def get_calibration_history(material_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT cr.id, cr.calibrated_at, cr.expires_at,
                       cr.certificate_url, cr.technician, cr.notes,
                       cr.created_by, cr.created_at, m.name, m.code
                FROM calibration_records cr
                JOIN materials m ON m.id = cr.material_id
                WHERE cr.material_id = %s
                ORDER BY cr.expires_at DESC
            """, (material_id,))
            rows = cur.fetchall()
    return [
        {
            "id":              str(r[0]),
            "calibrated_at":   r[1].isoformat() if r[1] else None,
            "expires_at":      r[2].isoformat() if r[2] else None,
            "certificate_url": r[3],
            "technician":      r[4],
            "notes":           r[5],
            "created_by":      r[6],
            "created_at":      r[7].isoformat() if r[7] else None,
            "material_name":   r[8],
            "material_code":   r[9],
        }
        for r in rows
    ]


def add_calibration_record(payload: dict, user_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO calibration_records
                    (material_id, calibrated_at, expires_at,
                     certificate_url, technician, notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                payload["material_id"],
                payload["calibrated_at"],
                payload["expires_at"],
                payload.get("certificate_url"),
                payload.get("technician"),
                payload.get("notes"),
                user_id,
            ))
            record_id = str(cur.fetchone()[0])
            if payload.get("certificate_url"):
                cur.execute(
                    "UPDATE materials SET calibration_cert_url=%s WHERE id=%s",
                    (payload["certificate_url"], payload["material_id"])
                )
            conn.commit()
    return {"id": record_id, "ok": True}


def set_material_calibration_flag(material_id: str, required: bool, interval_days: int = None):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE materials SET calibration_required=%s, calibration_interval_days=%s WHERE id=%s",
                (required, interval_days, material_id)
            )
            conn.commit()
    return {"ok": True}


# ============================================================
# PURCHASE ITEMS (Lista de compras)
# ============================================================

def get_purchase_items(project_id: str = None, status: str = None):
    with db_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT
                    pi.id, pi.material_id, pi.material_name_free,
                    pi.qty_needed, pi.unit, pi.project_id,
                    pi.source, pi.reason, pi.priority, pi.status,
                    pi.supplier_notes, pi.created_by, pi.created_at, pi.updated_at,
                    m.name  AS material_name,
                    m.code  AS material_code,
                    m.unit  AS material_unit,
                    p.code  AS project_code,
                    p.name  AS project_name
                FROM purchase_items pi
                LEFT JOIN materials m ON m.id = pi.material_id
                LEFT JOIN projects  p ON p.id = pi.project_id
                WHERE 1=1
            """
            params = []
            if project_id:
                query += " AND pi.project_id = %s"
                params.append(project_id)
            if status:
                query += " AND pi.status = %s"
                params.append(status)
            query += " ORDER BY pi.created_at DESC"
            cur.execute(query, params)
            rows = cur.fetchall()

    return [
        {
            "id":                str(r[0]),
            "material_id":       str(r[1]) if r[1] else None,
            "material_name_free":r[2],
            "qty_needed":        float(r[3]),
            "unit":              r[4] or r[16],
            "project_id":        str(r[5]) if r[5] else None,
            "source":            r[6],
            "reason":            r[7],
            "priority":          r[8],
            "status":            r[9],
            "supplier_notes":    r[10],
            "created_by":        r[11],
            "created_at":        r[12].isoformat() if r[12] else None,
            "updated_at":        r[13].isoformat() if r[13] else None,
            "material_name":     r[14] or r[2],
            "material_code":     r[15],
            "project_code":      r[17],
            "project_name":      r[18],
        }
        for r in rows
    ]


def add_purchase_item(payload: dict, user_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO purchase_items
                    (material_id, material_name_free, qty_needed, unit,
                     project_id, source, reason, priority, supplier_notes, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                payload.get("material_id"),
                payload.get("material_name_free"),
                payload.get("qty_needed", 1),
                payload.get("unit"),
                payload.get("project_id"),
                payload.get("source", "MANUAL"),
                payload.get("reason"),
                payload.get("priority", "NORMAL"),
                payload.get("supplier_notes"),
                user_id,
            ))
            item_id = str(cur.fetchone()[0])
            conn.commit()
    return {"id": item_id, "ok": True}


def bulk_add_purchase_items(items: list, user_id: str):
    """Bulk insert from requirements gap, skipping duplicates."""
    inserted = 0
    with db_connection() as conn:
        with conn.cursor() as cur:
            for item in items:
                cur.execute("""
                    SELECT id FROM purchase_items
                    WHERE material_id=%s AND project_id=%s
                      AND status NOT IN ('RECEIVED','CANCELLED')
                """, (item.get("material_id"), item.get("project_id")))
                if cur.fetchone():
                    continue
                cur.execute("""
                    INSERT INTO purchase_items
                        (material_id, material_name_free, qty_needed, unit,
                         project_id, source, reason, priority, created_by)
                    VALUES (%s, %s, %s, %s, %s, 'AUTO_GAP', %s, %s, %s)
                """, (
                    item.get("material_id"),
                    item.get("material_name_free"),
                    item.get("qty_needed", 1),
                    item.get("unit"),
                    item.get("project_id"),
                    item.get("reason", "Faltante en analisis de brecha de proyecto"),
                    item.get("priority", "NORMAL"),
                    user_id,
                ))
                inserted += 1
            conn.commit()
    return {"inserted": inserted, "ok": True}


def update_purchase_item_status(item_id: str, status: str, notes: str = None):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE purchase_items
                SET status=%s,
                    supplier_notes=COALESCE(%s, supplier_notes),
                    updated_at=NOW()
                WHERE id=%s
            """, (status, notes, item_id))
            conn.commit()
    return {"ok": True}


def delete_purchase_item(item_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM purchase_items WHERE id=%s", (item_id,))
            conn.commit()
    return {"ok": True}


# ============================================================
# REQUIREMENTS GAP (Brecha requerimientos por proyecto)
# ============================================================

def get_project_requirements_gap(project_id: str):
    """Compares material_requests for project vs available stock."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, code, name FROM projects WHERE id=%s", (project_id,))
            proj = cur.fetchone()
            if not proj:
                raise ValueError("Proyecto no encontrado")

            cur.execute("""
                SELECT
                    mr.related_material_id,
                    SUM(mr.quantity)                              AS total_requested,
                    MAX(mr.priority)                              AS priority,
                    MIN(mr.needed_by)                            AS needed_by,
                    m.code, m.name, m.unit, m.category,
                    COALESCE(stock.total_available, 0)           AS stock_available,
                    GREATEST(0, SUM(mr.quantity) - COALESCE(stock.total_available, 0)) AS shortage
                FROM material_requests mr
                LEFT JOIN materials m ON m.id = mr.related_material_id
                LEFT JOIN (
                    SELECT material_id, SUM(stock_available) AS total_available
                    FROM vw_stock_availability
                    GROUP BY material_id
                ) stock ON stock.material_id = mr.related_material_id
                WHERE mr.project_id = %s
                  AND mr.status NOT IN ('REJECTED', 'CANCELLED')
                  AND mr.related_material_id IS NOT NULL
                GROUP BY mr.related_material_id, m.code, m.name, m.unit, m.category, stock.total_available
                ORDER BY shortage DESC, priority DESC
            """, (project_id,))
            rows = cur.fetchall()

            cur.execute("""
                SELECT material_id FROM purchase_items
                WHERE project_id=%s AND status NOT IN ('RECEIVED','CANCELLED')
            """, (project_id,))
            in_purchase_set = {str(r[0]) for r in cur.fetchall()}

    items = []
    for r in rows:
        mat_id    = str(r[0]) if r[0] else None
        requested = float(r[1])
        available = float(r[8])
        shortage  = float(r[9])
        items.append({
            "material_id":      mat_id,
            "total_requested":  requested,
            "priority":         r[2],
            "needed_by":        r[3].isoformat() if r[3] else None,
            "material_code":    r[4],
            "material_name":    r[5],
            "unit":             r[6],
            "category":         r[7],
            "stock_available":  available,
            "shortage":         shortage,
            "covered_pct":      min(100, round(available / requested * 100, 1)) if requested > 0 else 100,
            "in_purchase_list": mat_id in in_purchase_set if mat_id else False,
        })

    fully_covered = sum(1 for i in items if i["shortage"] == 0)
    partial       = sum(1 for i in items if 0 < i["shortage"] < i["total_requested"])
    missing       = sum(1 for i in items if i["stock_available"] == 0 and i["total_requested"] > 0)

    return {
        "project": {"id": str(proj[0]), "code": proj[1], "name": proj[2]},
        "items":   items,
        "summary": {
            "total_materials":  len(items),
            "fully_covered":    fully_covered,
            "partial_coverage": partial,
            "not_in_stock":     missing,
        },
    }
'''

path = "app/modules/logistics/service.py"
with open(path, "a", encoding="utf-8") as f:
    f.write(NEW_CODE)

print("Appended successfully")
print(f"File now has {sum(1 for _ in open(path, encoding='utf-8'))} lines")
