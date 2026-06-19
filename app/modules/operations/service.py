from fastapi import HTTPException
from app.core.database import db_connection
from datetime import datetime
from uuid import uuid4


# ============================================================
# 📋 LISTAR PLANES DEL INGENIERO
# ============================================================

def list_my_plans_service(user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    pp.id,
                    pp.title,
                    pp.status,
                    pp.notes,
                    pp.created_at,
                    pp.updated_at,
                    pp.project_id,
                    COALESCE(p.code, pp.project_code)                       AS project_code,
                    COALESCE(p.name, pp.custom_project_name, pp.title)      AS project_name,
                    COUNT(ppi.id)                                            AS item_count,
                    COALESCE(SUM(
                        ppi.quantity
                        * COALESCE(m.unit_cost, 0)
                        * (ppi.wear_percentage / 100.0)
                    ), 0)                                                    AS total_cost
                FROM project_plans pp
                LEFT JOIN projects p             ON p.id  = pp.project_id
                LEFT JOIN project_plan_items ppi ON ppi.plan_id = pp.id
                LEFT JOIN materials m            ON m.id = ppi.material_id
                WHERE pp.engineer_id = %s
                GROUP BY pp.id, p.id
                ORDER BY pp.updated_at DESC
            """, (str(user["id"]),))

            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "title": r[1],
            "status": r[2],
            "notes": r[3],
            "created_at": r[4],
            "updated_at": r[5],
            "project_id": str(r[6]) if r[6] else None,
            "project_code": r[7],
            "project_name": r[8],
            "item_count": int(r[9]),
            "total_cost": float(r[10]),
        }
        for r in rows
    ]


# ============================================================
# ➕ CREAR PLAN
# ============================================================

def create_plan_service(payload, user):
    project_name = payload.custom_project_name
    with db_connection() as conn:
        with conn.cursor() as cur:
            # Auto-generate sequential code: PRO-YYYY-NNNN
            cur.execute("""
                SELECT COUNT(*) FROM project_plans
                WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
            """)
            count = cur.fetchone()[0]
            year = datetime.utcnow().year
            project_code = f"PRO-{year}-{str(count + 1).zfill(4)}"

            cur.execute("""
                INSERT INTO project_plans (
                    project_id, engineer_id, title, notes, status,
                    custom_project_name, project_code
                )
                VALUES (%s, %s, %s, %s, 'DRAFT', %s, %s)
                RETURNING id, title, status, created_at, project_code
            """, (
                str(payload.project_id) if payload.project_id else None,
                str(user["id"]),
                project_name,
                payload.notes,
                project_name,
                project_code,
            ))

            row = cur.fetchone()
            conn.commit()

    return {
        "id": str(row[0]),
        "title": row[1],
        "status": row[2],
        "created_at": row[3],
        "project_code": row[4],
        "project_name": project_name,
    }


# ============================================================
# 🔍 DETALLE DE UN PLAN (ítems + stock + costos)
# ============================================================

def get_plan_detail_service(plan_id: str, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            # 1. Cabecera del plan
            cur.execute("""
                SELECT
                    pp.id, pp.title, pp.status, pp.notes,
                    pp.created_at, pp.updated_at,
                    pp.project_id,
                    COALESCE(p.code, pp.project_code)                  AS project_code,
                    COALESCE(p.name, pp.custom_project_name, pp.title) AS project_name,
                    u.username AS engineer_name
                FROM project_plans pp
                LEFT JOIN projects p ON p.id = pp.project_id
                JOIN users         u ON u.id = pp.engineer_id
                WHERE pp.id = %s
            """, (plan_id,))

            plan_row = cur.fetchone()
            if not plan_row:
                raise HTTPException(404, "Plan no encontrado")

            # Engineers can only see their own plans (admins/logistics can see all)
            cur.execute("SELECT id FROM project_plans WHERE id = %s AND engineer_id = %s",
                        (plan_id, str(user["id"])))
            is_owner = cur.fetchone()
            roles = user.get("roles", [])
            is_staff = any(r in roles for r in ["admin", "Administrador", "Logística", "Supervisor"])
            if not is_owner and not is_staff:
                raise HTTPException(403, "Acceso denegado")

            # 2. Ítems + stock disponible + costos + submission_status
            cur.execute("""
                SELECT
                    ppi.id,
                    ppi.material_id,
                    m.name          AS material_name,
                    m.code          AS material_code,
                    m.category,
                    m.unit_cost,
                    ppi.quantity,
                    ppi.wear_percentage,
                    ppi.notes,
                    ppi.created_at,
                    COALESCE(
                        (SELECT SUM(va.stock_available)
                         FROM vw_stock_availability va
                         WHERE va.material_id = ppi.material_id),
                        0
                    ) AS stock_total,
                    ppi.submission_status
                FROM project_plan_items ppi
                JOIN materials m ON m.id = ppi.material_id
                WHERE ppi.plan_id = %s
                ORDER BY m.category, m.name
            """, (plan_id,))

            items = cur.fetchall()

    plan = {
        "id": str(plan_row[0]),
        "title": plan_row[1],
        "status": plan_row[2],
        "notes": plan_row[3],
        "created_at": plan_row[4],
        "updated_at": plan_row[5],
        "project_id": str(plan_row[6]),
        "project_code": plan_row[7],
        "project_name": plan_row[8],
        "engineer_name": plan_row[9],
    }

    item_list = []
    total_cost = 0.0

    for r in items:
        unit_cost = float(r[5]) if r[5] is not None else 0.0
        quantity  = float(r[6])
        wear_pct  = float(r[7])
        stock     = float(r[10])
        effective_cost = quantity * unit_cost * (wear_pct / 100.0)
        total_cost += effective_cost

        if stock >= quantity:
            stock_status = "AVAILABLE"
        elif stock > 0:
            stock_status = "PARTIAL"
        else:
            stock_status = "NEEDS_PURCHASE"

        item_list.append({
            "id": str(r[0]),
            "material_id": str(r[1]),
            "material_name": r[2],
            "material_code": r[3],
            "category": r[4],
            "unit_cost": unit_cost,
            "quantity": quantity,
            "wear_percentage": wear_pct,
            "notes": r[8],
            "created_at": r[9],
            "stock_available": stock,
            "stock_status": stock_status,
            "effective_cost": effective_cost,
            "submission_status": r[11],
        })

    plan["items"] = item_list
    plan["total_cost"] = total_cost
    return plan


# ============================================================
# ➕ AGREGAR ÍTEM AL PLAN
# ============================================================

def add_plan_item_service(plan_id: str, payload, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT status, engineer_id FROM project_plans WHERE id = %s
            """, (plan_id,))
            plan = cur.fetchone()
            if not plan:
                raise HTTPException(404, "Plan no encontrado")
            if str(plan[1]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede modificar este plan")

            cur.execute("SELECT id, name FROM materials WHERE id = %s", (str(payload.material_id),))
            mat = cur.fetchone()
            if not mat:
                raise HTTPException(404, "Material no encontrado")

            cur.execute("""
                INSERT INTO project_plan_items (plan_id, material_id, quantity, wear_percentage, notes)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (plan_id, material_id)
                DO UPDATE SET
                    quantity        = EXCLUDED.quantity,
                    wear_percentage = EXCLUDED.wear_percentage,
                    notes           = EXCLUDED.notes,
                    updated_at      = NOW()
                RETURNING id
            """, (plan_id, str(payload.material_id), payload.quantity, payload.wear_percentage, payload.notes))

            item_id = cur.fetchone()[0]

            # Touch the plan's updated_at
            cur.execute("UPDATE project_plans SET updated_at = NOW() WHERE id = %s", (plan_id,))
            conn.commit()

    return {"id": str(item_id), "status": "OK"}


# ============================================================
# ✏️ ACTUALIZAR ÍTEM (qty + wear%)
# ============================================================

def update_plan_item_service(plan_id: str, item_id: str, payload, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT pp.engineer_id
                FROM project_plan_items ppi
                JOIN project_plans pp ON pp.id = ppi.plan_id
                WHERE ppi.id = %s AND ppi.plan_id = %s
            """, (item_id, plan_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Ítem no encontrado")
            if str(row[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede modificar este plan")

            updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
            if not updates:
                return {"status": "no_changes"}

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            values = list(updates.values()) + [item_id]
            cur.execute(
                f"UPDATE project_plan_items SET {set_clause}, updated_at = NOW() WHERE id = %s",
                values
            )
            cur.execute("UPDATE project_plans SET updated_at = NOW() WHERE id = %s", (plan_id,))
            conn.commit()

    return {"status": "updated"}


# ============================================================
# 🗑️ ELIMINAR ÍTEM
# ============================================================

def remove_plan_item_service(plan_id: str, item_id: str, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT pp.engineer_id
                FROM project_plan_items ppi
                JOIN project_plans pp ON pp.id = ppi.plan_id
                WHERE ppi.id = %s AND ppi.plan_id = %s
            """, (item_id, plan_id))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Ítem no encontrado")
            if str(row[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede modificar este plan")

            cur.execute("DELETE FROM project_plan_items WHERE id = %s", (item_id,))
            cur.execute("UPDATE project_plans SET updated_at = NOW() WHERE id = %s", (plan_id,))
            conn.commit()

    return {"status": "deleted"}


# ============================================================
# 📤 CREAR SUBMISSION (lote de requerimiento numerado)
# Solo incluye ítems con submission_status = 'PENDING'
# Cada envío tiene un número secuencial (Req-1, Req-2, ...)
# ============================================================

def create_submission_service(plan_id: str, user, reason: str | None = None):
    with db_connection() as conn:
        with conn.cursor() as cur:

            cur.execute("""
                SELECT pp.engineer_id,
                       COALESCE(p.name, pp.custom_project_name, pp.title) AS project_name
                FROM project_plans pp
                LEFT JOIN projects p ON p.id = pp.project_id
                WHERE pp.id = %s
            """, (plan_id,))
            plan = cur.fetchone()
            if not plan:
                raise HTTPException(404, "Plan no encontrado")
            if str(plan[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede enviar requerimientos")

            # Only PENDING items (not yet in any active submission)
            cur.execute("""
                SELECT
                    ppi.id,
                    ppi.material_id,
                    m.name,
                    m.code,
                    m.category,
                    m.unit_cost,
                    ppi.quantity,
                    ppi.wear_percentage,
                    COALESCE(
                        (SELECT SUM(va.stock_available)
                         FROM vw_stock_availability va
                         WHERE va.material_id = ppi.material_id),
                        0
                    ) AS stock_total
                FROM project_plan_items ppi
                JOIN materials m ON m.id = ppi.material_id
                WHERE ppi.plan_id = %s AND ppi.submission_status = 'PENDING'
            """, (plan_id,))
            items = cur.fetchall()

            if not items:
                raise HTTPException(400, "No hay ítems pendientes de envío en este plan")

            # Next submission number
            cur.execute(
                "SELECT COALESCE(MAX(submission_number), 0) + 1 FROM project_plan_submissions WHERE plan_id = %s",
                (plan_id,)
            )
            submission_number = cur.fetchone()[0]

            # Create submission record
            cur.execute("""
                INSERT INTO project_plan_submissions
                    (plan_id, submission_number, status, reason, submitted_at)
                VALUES (%s, %s, 'PENDING', %s, NOW())
                RETURNING id
            """, (plan_id, submission_number, reason))
            submission_id = str(cur.fetchone()[0])

            # Snapshot items
            for (item_id, material_id, mat_name, mat_code, category,
                 unit_cost, quantity, wear_pct, stock_total) in items:
                cur.execute("""
                    INSERT INTO project_plan_submission_items
                        (submission_id, plan_item_id, material_id, material_name, material_code,
                         category, quantity, unit_cost, wear_percentage, stock_available)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """, (
                    submission_id, str(item_id), str(material_id),
                    mat_name, mat_code, category,
                    float(quantity), float(unit_cost) if unit_cost else None,
                    float(wear_pct), float(stock_total),
                ))

            # Mark items as IN_REVIEW
            cur.execute("""
                UPDATE project_plan_items
                SET submission_status = 'IN_REVIEW'
                WHERE plan_id = %s AND submission_status = 'PENDING'
            """, (plan_id,))

            # Plan moves to ACTIVE (stays editable)
            cur.execute(
                "UPDATE project_plans SET status = 'ACTIVE', updated_at = NOW() WHERE id = %s",
                (plan_id,)
            )
            conn.commit()

    return {
        "plan_id": plan_id,
        "submission_id": submission_id,
        "submission_number": submission_number,
        "items_sent": len(items),
        "status": "PENDING",
    }


# ============================================================
# 🔁 CLONAR PLAN (con partidas, APUs y config)
# ============================================================

def clone_plan_service(plan_id: str, user) -> dict:
    with db_connection() as conn:
        try:
            with conn.cursor() as cur:
                # 1. Leer cabecera del plan original
                cur.execute("""
                    SELECT project_id, title, notes, custom_project_name
                    FROM project_plans WHERE id = %s
                """, (plan_id,))
                row = cur.fetchone()
                if not row:
                    raise HTTPException(404, "Plan no encontrado")
                orig_project_id, title, notes, custom_project_name = row

                # 2. Generar nuevo código correlativo
                cur.execute("""
                    SELECT COUNT(*) FROM project_plans
                    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())
                """)
                count = cur.fetchone()[0]
                year = datetime.utcnow().year
                new_code = f"PRO-{year}-{str(count + 1).zfill(4)}"

                # 3. Insertar clon del plan
                new_plan_id = str(uuid4())
                cur.execute("""
                    INSERT INTO project_plans
                        (id, project_id, engineer_id, title, notes, status,
                         custom_project_name, project_code)
                    VALUES (%s, %s, %s, %s, %s, 'DRAFT', %s, %s)
                """, (
                    new_plan_id,
                    str(orig_project_id) if orig_project_id else None,
                    str(user["id"]),
                    f"[CLON] {title}" if title else None,
                    notes,
                    f"[CLON] {custom_project_name}" if custom_project_name else None,
                    new_code,
                ))

                # 4. Clonar presupuesto_config
                cur.execute("""
                    SELECT gastos_generales_pct, utilidad_pct, igv_pct, moneda,
                           cliente_id, cliente_nombre, cliente_ruc, lugar_trabajo,
                           plazo_dias, validez_dias, notas, notas_comerciales
                    FROM presupuesto_config WHERE plan_id = %s
                """, (plan_id,))
                cfg = cur.fetchone()
                if cfg:
                    cur.execute("""
                        INSERT INTO presupuesto_config
                            (plan_id, gastos_generales_pct, utilidad_pct, igv_pct, moneda,
                             cliente_id, cliente_nombre, cliente_ruc, lugar_trabajo,
                             plazo_dias, validez_dias, notas, notas_comerciales,
                             status, numero_cotizacion, fecha_envio, fecha_respuesta)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'BORRADOR',NULL,NULL,NULL)
                    """, (new_plan_id, *cfg))

                # 4b. Clonar project_plan_items (materiales de la requisición del plan)
                cur.execute("""
                    SELECT material_id, quantity, wear_percentage, notes
                    FROM project_plan_items WHERE plan_id = %s
                """, (plan_id,))
                for ppi in cur.fetchall():
                    cur.execute("""
                        INSERT INTO project_plan_items
                            (plan_id, material_id, quantity, wear_percentage, notes, submission_status)
                        VALUES (%s, %s, %s, %s, %s, 'PENDING')
                    """, (new_plan_id, str(ppi[0]), float(ppi[1]), float(ppi[2]), ppi[3]))

                # 5. Clonar partidas (preservando jerarquía con mapeo old→new id)
                cur.execute("""
                    SELECT id, codigo, descripcion, unidad, cantidad, orden,
                           es_capitulo, parent_id
                    FROM presupuesto_partidas WHERE plan_id = %s ORDER BY orden
                """, (plan_id,))
                partidas = cur.fetchall()

                partida_id_map = {}
                for p in partidas:
                    old_id = str(p[0])
                    new_partida_id = str(uuid4())
                    partida_id_map[old_id] = new_partida_id
                    new_parent_id = partida_id_map.get(str(p[7])) if p[7] else None
                    cur.execute("""
                        INSERT INTO presupuesto_partidas
                            (id, plan_id, codigo, descripcion, unidad, cantidad,
                             orden, es_capitulo, parent_id)
                        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        new_partida_id, new_plan_id,
                        p[1], p[2], p[3], p[4], p[5], p[6], new_parent_id,
                    ))

                    # 6. Clonar APU items de cada partida
                    cur.execute("""
                        SELECT tipo_recurso, material_id, recurso_mo_id,
                               descripcion, unidad, cantidad, precio_unitario
                        FROM presupuesto_apu_items WHERE partida_id = %s
                    """, (old_id,))
                    for apu in cur.fetchall():
                        cur.execute("""
                            INSERT INTO presupuesto_apu_items
                                (partida_id, tipo_recurso, material_id, recurso_mo_id,
                                 descripcion, unidad, cantidad, precio_unitario)
                            VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
                        """, (new_partida_id, *apu))

            conn.commit()

        except Exception:
            conn.rollback()
            raise

    return {
        "cloned_plan_id": new_plan_id,
        "project_code": new_code,
        "status": "DRAFT",
        "partidas_clonadas": len(partidas),
    }


# ============================================================
# 📋 LISTAR SUBMISSIONS DE UN PLAN
# ============================================================

def list_plan_submissions_service(plan_id: str, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            # Verify access
            cur.execute("SELECT engineer_id FROM project_plans WHERE id = %s", (plan_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Plan no encontrado")
            roles = user.get("roles", [])
            is_staff = any(r in roles for r in ["admin", "Administrador", "Logística", "Supervisor"])
            if str(row[0]) != str(user["id"]) and not is_staff:
                raise HTTPException(403, "Acceso denegado")

            cur.execute("""
                SELECT
                    s.id, s.submission_number, s.status,
                    s.reason, s.submitted_at, s.reviewed_at,
                    s.logistics_notes,
                    COUNT(si.id) AS item_count,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'APPROVED') AS approved,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'REJECTED') AS rejected,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'PARTIAL')  AS partial
                FROM project_plan_submissions s
                LEFT JOIN project_plan_submission_items si ON si.submission_id = s.id
                WHERE s.plan_id = %s
                GROUP BY s.id
                ORDER BY s.submission_number DESC
            """, (plan_id,))
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "submission_number": r[1],
            "status": r[2],
            "reason": r[3],
            "submitted_at": r[4],
            "reviewed_at": r[5],
            "logistics_notes": r[6],
            "item_count": int(r[7]),
            "approved": int(r[8]),
            "rejected": int(r[9]),
            "partial": int(r[10]),
        }
        for r in rows
    ]


# ============================================================
# 📋 LISTAR TODAS MIS SUBMISSIONS (global, todos los planes)
# ============================================================

def list_my_all_submissions_service(user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    s.id, s.submission_number, s.status,
                    s.reason, s.submitted_at, s.reviewed_at,
                    s.logistics_notes,
                    pp.id,
                    COALESCE(p.name, pp.custom_project_name, pp.title) AS project_name,
                    COALESCE(p.code, pp.project_code)                  AS project_code,
                    COUNT(si.id)                                                          AS item_count,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'APPROVED')          AS approved,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'REJECTED')          AS rejected,
                    COUNT(si.id) FILTER (WHERE si.logistics_status = 'PARTIAL')           AS partial
                FROM project_plan_submissions s
                JOIN project_plans pp ON pp.id = s.plan_id
                LEFT JOIN projects p  ON p.id  = pp.project_id
                LEFT JOIN project_plan_submission_items si ON si.submission_id = s.id
                WHERE pp.engineer_id = %s
                GROUP BY s.id, pp.id, p.id
                ORDER BY s.submitted_at DESC
            """, (str(user["id"]),))
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "submission_number": r[1],
            "status": r[2],
            "reason": r[3],
            "submitted_at": r[4],
            "reviewed_at": r[5],
            "logistics_notes": r[6],
            "plan_id": str(r[7]),
            "project_name": r[8],
            "project_code": r[9],
            "item_count": int(r[10]),
            "approved": int(r[11]),
            "rejected": int(r[12]),
            "partial": int(r[13]),
        }
        for r in rows
    ]


# ============================================================
# ✏️ ACTUALIZAR CABECERA DEL PLAN
# ============================================================

def update_plan_service(plan_id: str, payload, user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT engineer_id FROM project_plans WHERE id = %s", (plan_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Plan no encontrado")
            if str(row[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede modificar este plan")

            updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
            if not updates:
                return {"status": "no_changes"}

            set_clause = ", ".join(f"{k} = %s" for k in updates)
            values = list(updates.values()) + [plan_id]
            cur.execute(
                f"UPDATE project_plans SET {set_clause}, updated_at = NOW() WHERE id = %s",
                values
            )
            conn.commit()

    return {"status": "updated"}


# ============================================================
# 🗑️ ELIMINAR PLAN
# ============================================================

def delete_plan_service(plan_id: str, user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT engineer_id FROM project_plans WHERE id = %s", (plan_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Plan no encontrado")
            if str(row[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede eliminar este plan")

            cur.execute("DELETE FROM project_plans WHERE id = %s", (plan_id,))
            conn.commit()

    return {"status": "deleted"}


# ============================================================
# 🆕 PROPONER NUEVO MATERIAL (no existe en catálogo)
# ============================================================

def propose_material_service(payload, user):
    with db_connection() as conn:
        with conn.cursor() as cur:

            # Auto-code: PROP-YYYY-NNNN  (sequential across all proposed)
            cur.execute("""
                SELECT COUNT(*) FROM materials WHERE validation_status = 'PENDING'
            """)
            count = cur.fetchone()[0]
            year = datetime.utcnow().year
            code = f"PROP-{year}-{str(count + 1).zfill(4)}"

            # Ensure code uniqueness (extremely unlikely collision but safe)
            cur.execute("SELECT id FROM materials WHERE code = %s", (code,))
            if cur.fetchone():
                code = f"PROP-{year}-{str(count + 100).zfill(4)}"

            cur.execute("""
                INSERT INTO materials (
                    name, code, category, unit_cost, min_stock,
                    validation_status, proposed_by, proposed_at
                )
                VALUES (%s, %s, %s, %s, 0, 'PENDING', %s, NOW())
                RETURNING id, name, code, category, unit_cost
            """, (
                payload.name.strip(),
                code,
                payload.category or "Sin categoría",
                payload.unit_cost,
                str(user["id"]),
            ))

            row = cur.fetchone()

            # Save engineer notes as logistics_notes placeholder
            if payload.notes:
                cur.execute(
                    "UPDATE materials SET logistics_notes = %s WHERE id = %s",
                    (payload.notes, str(row[0]))
                )

            conn.commit()

    return {
        "id": str(row[0]),
        "name": row[1],
        "code": row[2],
        "category": row[3],
        "unit_cost": float(row[4]) if row[4] is not None else None,
        "validation_status": "PENDING",
    }


# ============================================================
# 📦 BÓVEDAS / GRUPOS DE MATERIALES
# ============================================================

def list_material_groups_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    mg.id, mg.name, mg.description, mg.category,
                    mg.created_at, mg.updated_at,
                    COUNT(mgi.id) AS item_count
                FROM material_groups mg
                LEFT JOIN material_group_items mgi ON mgi.group_id = mg.id
                GROUP BY mg.id
                ORDER BY mg.category, mg.name
            """)
            rows = cur.fetchall()
    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "description": r[2],
            "category": r[3],
            "created_at": r[4],
            "updated_at": r[5],
            "item_count": int(r[6]),
        }
        for r in rows
    ]


def get_material_group_service(group_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, name, description, category FROM material_groups WHERE id = %s",
                (group_id,)
            )
            group = cur.fetchone()
            if not group:
                raise HTTPException(404, "Grupo no encontrado")

            cur.execute("""
                SELECT mgi.id, mgi.material_id, m.name, m.code, m.category,
                       m.unit_cost, mgi.quantity, mgi.wear_percentage, mgi.notes
                FROM material_group_items mgi
                JOIN materials m ON m.id = mgi.material_id
                WHERE mgi.group_id = %s
                ORDER BY m.category, m.name
            """, (group_id,))
            items = cur.fetchall()

    return {
        "id": str(group[0]),
        "name": group[1],
        "description": group[2],
        "category": group[3],
        "items": [
            {
                "id": str(r[0]),
                "material_id": str(r[1]),
                "material_name": r[2],
                "material_code": r[3],
                "category": r[4],
                "unit_cost": float(r[5]) if r[5] is not None else None,
                "quantity": float(r[6]),
                "wear_percentage": float(r[7]),
                "notes": r[8],
            }
            for r in items
        ],
    }


def create_material_group_service(payload, user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO material_groups (name, description, category, created_by)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, description, category
            """, (
                payload.name.strip(),
                payload.description,
                payload.category or "General",
                str(user["id"]),
            ))
            row = cur.fetchone()
            conn.commit()
    return {
        "id": str(row[0]),
        "name": row[1],
        "description": row[2],
        "category": row[3],
        "item_count": 0,
    }


def update_material_group_service(group_id: str, payload):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM material_groups WHERE id = %s", (group_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Grupo no encontrado")
            updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
            if not updates:
                return {"status": "no_changes"}
            set_clause = ", ".join(f"{k} = %s" for k in updates)
            values = list(updates.values()) + [group_id]
            cur.execute(
                f"UPDATE material_groups SET {set_clause}, updated_at = NOW() WHERE id = %s",
                values
            )
            conn.commit()
    return {"status": "updated"}


def delete_material_group_service(group_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM material_groups WHERE id = %s", (group_id,))
            conn.commit()
    return {"status": "deleted"}


def add_item_to_group_service(group_id: str, payload):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM material_groups WHERE id = %s", (group_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Grupo no encontrado")
            cur.execute("SELECT id FROM materials WHERE id = %s", (str(payload.material_id),))
            if not cur.fetchone():
                raise HTTPException(404, "Material no encontrado")

            cur.execute("""
                INSERT INTO material_group_items (group_id, material_id, quantity, wear_percentage, notes)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (group_id, material_id)
                DO UPDATE SET
                    quantity        = EXCLUDED.quantity,
                    wear_percentage = EXCLUDED.wear_percentage,
                    notes           = EXCLUDED.notes
                RETURNING id
            """, (
                group_id,
                str(payload.material_id),
                payload.quantity,
                payload.wear_percentage,
                payload.notes,
            ))
            item_id = cur.fetchone()[0]
            cur.execute("UPDATE material_groups SET updated_at = NOW() WHERE id = %s", (group_id,))
            conn.commit()
    return {"id": str(item_id), "status": "OK"}


def remove_item_from_group_service(group_id: str, item_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM material_group_items WHERE id = %s AND group_id = %s",
                (item_id, group_id)
            )
            cur.execute("UPDATE material_groups SET updated_at = NOW() WHERE id = %s", (group_id,))
            conn.commit()
    return {"status": "deleted"}


def apply_group_to_plan_service(plan_id: str, group_id: str, user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT engineer_id FROM project_plans WHERE id = %s", (plan_id,))
            plan = cur.fetchone()
            if not plan:
                raise HTTPException(404, "Plan no encontrado")
            if str(plan[0]) != str(user["id"]):
                raise HTTPException(403, "Solo el ingeniero responsable puede modificar este plan")

            cur.execute("""
                SELECT mgi.material_id, mgi.quantity, mgi.wear_percentage, mgi.notes
                FROM material_group_items mgi
                WHERE mgi.group_id = %s
            """, (group_id,))
            items = cur.fetchall()

            if not items:
                raise HTTPException(400, "El grupo no tiene materiales")

            added = 0
            for (material_id, quantity, wear_pct, notes) in items:
                cur.execute("""
                    INSERT INTO project_plan_items
                        (plan_id, material_id, quantity, wear_percentage, notes)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (plan_id, material_id)
                    DO UPDATE SET
                        quantity        = EXCLUDED.quantity,
                        wear_percentage = EXCLUDED.wear_percentage,
                        notes           = COALESCE(EXCLUDED.notes, project_plan_items.notes),
                        updated_at      = NOW()
                """, (plan_id, str(material_id), float(quantity), float(wear_pct), notes))
                added += 1

            cur.execute("UPDATE project_plans SET updated_at = NOW() WHERE id = %s", (plan_id,))
            conn.commit()

    return {"status": "applied", "items_added": added, "group_id": group_id}
