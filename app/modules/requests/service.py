from app.core.database import db_connection
from uuid import uuid4
from datetime import datetime, timedelta
from fastapi import HTTPException

# ===============================
# RESERVAS
# ===============================

def list_my_reservations_service(user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    material_id,
                    warehouse_id,
                    quantity,
                    status,
                    created_at,
                    expires_at
                FROM stock_reservations
                WHERE reserved_by = %s
                ORDER BY created_at DESC
            """, (user["id"],))

            return [
                {
                    "id": r[0],
                    "material_id": r[1],
                    "warehouse_id": r[2],
                    "quantity": r[3],
                    "status": r[4],
                    "created_at": r[5],
                    "expires_at": r[6],
                }
                for r in cur.fetchall()
            ]

# ===============================
# SOLICITUDES DE MATERIAL
# ===============================

def _insert_items(cur, request_id, items):
    material_ids = [str(item.material_id) for item in items]
    if len(material_ids) != len(set(material_ids)):
        raise HTTPException(422, "No puede haber materiales duplicados en una misma solicitud")
    for item in items:
        cur.execute("SELECT id FROM materials WHERE id = %s", (str(item.material_id),))
        if not cur.fetchone():
            raise HTTPException(422, f"Material {item.material_id} no existe")
        cur.execute("""
            INSERT INTO material_request_items (id, request_id, material_id, quantity)
            VALUES (gen_random_uuid(), %s, %s, %s)
        """, (str(request_id), str(item.material_id), item.quantity))


def _get_items_for_request(cur, request_id):
    cur.execute("""
        SELECT mri.material_id, m.name, m.code, mri.quantity
        FROM material_request_items mri
        JOIN materials m ON m.id = mri.material_id
        WHERE mri.request_id = %s
    """, (str(request_id),))
    rows = cur.fetchall()
    if rows:
        return [{"material_id": str(r[0]), "material_name": r[1], "material_code": r[2], "quantity": float(r[3])} for r in rows]
    cur.execute("""
        SELECT mr.related_material_id, m.name, m.code, mr.quantity
        FROM material_requests mr
        JOIN materials m ON m.id = mr.related_material_id
        WHERE mr.id = %s
    """, (str(request_id),))
    row = cur.fetchone()
    if row:
        return [{"material_id": str(row[0]), "material_name": row[1], "material_code": row[2], "quantity": float(row[3])}]
    return []


def _record_audit(cur, request_id, action, old_status, new_status, actor_id):
    cur.execute("""
        INSERT INTO material_request_audit
            (id, material_request_id, action, old_status, new_status, actor_id, source, created_at)
        VALUES
            (gen_random_uuid(), %s, %s, %s, %s, %s, 'API', NOW())
    """, (str(request_id), action, old_status, new_status, str(actor_id) if actor_id else None))


def create_material_request_service(payload, user):
    request_id = uuid4()
    sla_due_at = datetime.utcnow() + timedelta(hours=72)

    multi_item_mode = payload.items and len(payload.items) > 0

    if multi_item_mode:
        first_item = payload.items[0]
        anchor_material_id = str(first_item.material_id)
        anchor_quantity = first_item.quantity
    else:
        if not payload.related_material_id or not payload.quantity:
            raise HTTPException(422, "Modo legacy requiere related_material_id y quantity")
        anchor_material_id = str(payload.related_material_id)
        anchor_quantity = payload.quantity

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO material_requests (
                    id,
                    requested_by,
                    related_material_id,
                    quantity,
                    reason,
                    status,
                    priority,
                    sla_due_at,
                    source,
                    created_at,
                    project_id
                )
                VALUES (
                    %s, %s, %s, %s, %s,
                    'PENDING',
                    'MEDIUM',
                    %s,
                    'MANUAL',
                    NOW(),
                    %s
                )
            """, (
                str(request_id),
                str(user["id"]),
                anchor_material_id,
                anchor_quantity,
                payload.reason,
                sla_due_at,
                str(payload.project_id)
            ))

            if multi_item_mode:
                _insert_items(cur, request_id, payload.items)

        conn.commit()

    return {
        "id": str(request_id),
        "status": "PENDING",
        "sla_due_at": sla_due_at
    }



def list_my_material_requests_service(user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    mr.id,
                    mr.reason,
                    mr.status,
                    mr.priority,
                    mr.needed_by,
                    mr.created_at,
                    mr.approved_by,
                    mr.approved_at,
                    mr.project_id,
                    p.name AS project_name
                FROM material_requests mr
                LEFT JOIN projects p ON p.id = mr.project_id
                WHERE mr.requested_by = %s
                ORDER BY mr.created_at DESC
            """, (str(user["id"]),))

            rows = cur.fetchall()
            result = []
            for r in rows:
                items = _get_items_for_request(cur, r[0])
                result.append({
                    "id": r[0],
                    "reason": r[1],
                    "status": r[2],
                    "priority": r[3],
                    "needed_by": r[4],
                    "created_at": r[5],
                    "approved_by": r[6],
                    "approved_at": r[7],
                    "project_id": str(r[8]) if r[8] else None,
                    "project_name": r[9],
                    "items": items,
                })
        return result



def list_all_material_requests_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    mr.id,
                    mr.reason,
                    mr.status,
                    mr.priority,
                    mr.sla_due_at,
                    mr.created_at,
                    mr.approved_at,
                    mr.rejected_at,
                    u.username  AS requested_by,
                    mr.project_id,
                    p.name      AS project_name
                FROM material_requests mr
                JOIN users u ON u.id = mr.requested_by
                LEFT JOIN projects p ON p.id = mr.project_id
                ORDER BY mr.created_at DESC
            """)
            rows = cur.fetchall()
            result = []
            for r in rows:
                items = _get_items_for_request(cur, r[0])
                result.append({
                    "id": r[0],
                    "reason": r[1],
                    "status": r[2],
                    "priority": r[3],
                    "sla_due_at": r[4],
                    "created_at": r[5],
                    "approved_at": r[6],
                    "rejected_at": r[7],
                    "requested_by": r[8],
                    "project_id": str(r[9]) if r[9] else None,
                    "project_name": r[10],
                    "items": items,
                })
        return result






def approve_material_request_service(request_id: str, current_user):
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:

                # 1️⃣ Bloquear solicitud
                cur.execute("""
                    SELECT status
                    FROM material_requests
                    WHERE id = %s
                    FOR UPDATE
                """, (request_id,))

                row = cur.fetchone()

                if not row:
                    raise HTTPException(404, "Solicitud no encontrada")

                status = row[0]

                if status != "PENDING":
                    raise HTTPException(
                        400,
                        f"No se puede aprobar una solicitud en estado {status}"
                    )

                # 2️⃣ Aprobar
                cur.execute("""
                    UPDATE material_requests
                    SET
                        status = 'APPROVED',
                        approved_at = NOW(),
                        approved_by = %s
                    WHERE id = %s
                """, (
                    current_user["id"],
                    request_id
                ))

                _record_audit(cur, request_id, 'APPROVED', status, 'APPROVED', current_user["id"])

            conn.commit()

            return {
                "id": request_id,
                "status": "APPROVED"
            }

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=str(e).split("\n")[0]
        )





def reject_material_request_service(request_id: str, user):
    with db_connection() as conn:
        try:
            with conn.cursor() as cur:

                # 1️⃣ Bloquear solicitud
                cur.execute("""
                    SELECT status
                    FROM material_requests
                    WHERE id = %s
                    FOR UPDATE
                """, (str(request_id),))

                row = cur.fetchone()

                if not row:
                    raise HTTPException(404, "Solicitud no existe")

                status = row[0]

                # 2️⃣ Validación dura
                if status != "PENDING":
                    raise HTTPException(
                        400,
                        f"No se puede rechazar una solicitud en estado {status}"
                    )

                # 3️⃣ Rechazar
                cur.execute("""
                    UPDATE material_requests
                    SET
                        status = 'REJECTED',
                        rejected_by = %s,
                        rejected_at = NOW()
                    WHERE id = %s
                """, (
                    str(user["id"]),
                    str(request_id)
                ))

                _record_audit(cur, request_id, 'REJECTED', status, 'REJECTED', user["id"])

            conn.commit()

            return {
                "id": request_id,
                "status": "REJECTED",
                "rejected_at": datetime.utcnow()
            }

        except Exception:
            conn.rollback()
            raise

def get_request_history_service(request_id, current_user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, requested_by FROM material_requests WHERE id = %s
            """, (str(request_id),))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Solicitud no encontrada")

            request_owner = str(row[1])
            user_id = str(current_user["id"])
            user_permissions = current_user.get("permissions", [])

            if user_id != request_owner and "logistics:stock:move" not in user_permissions:
                raise HTTPException(403, "No tienes permiso para ver el historial de esta solicitud")

            cur.execute("""
                SELECT a.id, a.action, a.old_status, a.new_status,
                       u.username AS actor_name, a.source, a.created_at
                FROM material_request_audit a
                LEFT JOIN users u ON u.id = a.actor_id
                WHERE a.material_request_id = %s
                ORDER BY a.created_at ASC
            """, (str(request_id),))

            return [
                {
                    "id": str(r[0]),
                    "action": r[1],
                    "old_status": r[2],
                    "new_status": r[3],
                    "actor_name": r[4],
                    "source": r[5],
                    "created_at": r[6],
                }
                for r in cur.fetchall()
            ]


##########################################################################




# =====================================
# RECEPCION DE MATERIALES RESERVADOS
# =====================================

# def receive_reservation_service(payload, user):
#     with db_connection() as conn:
#         try:
#             with conn.cursor() as cur:

#                 # 1️⃣ Bloquear reserva
#                 cur.execute("""
#                     SELECT material_id, warehouse_id, quantity, project_id
#                     FROM stock_reservations
#                     WHERE id = %s
#                       AND status = 'IN_TRANSIT'
#                     FOR UPDATE
#                 """, (str(payload.reservation_id),))

#                 res = cur.fetchone()
#                 if not res:
#                     raise HTTPException(
#                         404,
#                         "Reserva no válida o no está en tránsito"
#                     )

#                 material_id, from_warehouse, qty, project_id = res

#                 # 2️⃣ Insert / Upsert destino (UUID → str)
#                 cur.execute("""
#                     INSERT INTO stock_locations (
#                         id,
#                         material_id,
#                         warehouse_id,
#                         rack,
#                         level,
#                         box,
#                         position,
#                         quantity,
#                         created_at,
#                         updated_at
#                     )
#                     VALUES (
#                         gen_random_uuid(),
#                         %s, %s,
#                         %s, %s, %s, %s,
#                         %s,
#                         NOW(),
#                         NOW()
#                     )
#                     ON CONFLICT (material_id, warehouse_id, rack, level, box, position)
#                     DO UPDATE SET
#                         quantity = stock_locations.quantity + EXCLUDED.quantity,
#                         updated_at = NOW();
#                 """, (
#                     str(material_id),
#                     str(payload.to_warehouse_id),
#                     payload.rack,
#                     payload.level,
#                     payload.box,
#                     payload.position,
#                     qty
#                 ))

#                 # 3️⃣ Cerrar reserva
#                 cur.execute("""
#                     UPDATE stock_reservations
#                     SET status = 'FULFILLED'
#                     WHERE id = %s
#                 """, (str(payload.reservation_id),))

#             conn.commit()

#             return {
#                 "reservation_id": payload.reservation_id,
#                 "status": "FULFILLED",
#                 "received_at": datetime.utcnow()
#             }

#         except Exception:
#             conn.rollback()
#             raise


# def extend_reservation_service(reservation_id: str, user):
#     with db_connection() as conn:
#         try:
#             with conn.cursor() as cur:

#                 # 1️⃣ Bloquear reserva
#                 cur.execute("""
#                     SELECT status, expires_at, extension_count
#                     FROM stock_reservations
#                     WHERE id = %s
#                     FOR UPDATE
#                 """, (reservation_id,))

#                 row = cur.fetchone()
#                 if not row:
#                     raise HTTPException(404, "Reserva no encontrada")

#                 status, expires_at, extension_count = row

#                 # 2️⃣ Validaciones
#                 if status != "ACTIVE":
#                     raise HTTPException(
#                         400,
#                         "Solo se pueden extender reservas ACTIVAS"
#                     )

#                 if extension_count >= 3:
#                     raise HTTPException(
#                         400,
#                         "La reserva ya alcanzó el máximo de extensiones (3)"
#                     )

#                 # 3️⃣ Extender reserva
#                 cur.execute("""
#                     UPDATE stock_reservations
#                     SET
#                         expires_at = expires_at + INTERVAL '24 hours',
#                         extension_count = extension_count + 1
#                     WHERE id = %s
#                     RETURNING expires_at, extension_count
#                 """, (reservation_id,))

#                 new_expires_at, new_extension_count = cur.fetchone()

#             conn.commit()

#             return {
#                 "reservation_id": reservation_id,
#                 "new_expires_at": new_expires_at,
#                 "extension_count": new_extension_count,
#                 "extended_at": datetime.utcnow()
#             }

#         except Exception:
#             conn.rollback()
#             raise


#=================================================================

def list_operational_material_requests_service():
    """
    Vista operativa para logística.
    Usa la vista vw_material_requests_operational.
    """
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    id,
                    requested_by,
                    related_material_id,
                    quantity,
                    reason,
                    status,
                    priority,
                    operational_status,
                    hours_to_sla,
                    created_at,
                    sla_due_at
                FROM vw_material_requests_operational
                ORDER BY
                    operational_status DESC,
                    hours_to_sla ASC NULLS LAST;
            """)

            rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "requested_by": r[1],
                "material_id": r[2],
                "quantity": float(r[3]),
                "reason": r[4],
                "status": r[5],
                "priority": r[6],
                "operational_status": r[7],
                "hours_to_sla": float(r[8]) if r[8] is not None else None,
                "created_at": r[9],
                "sla_due_at": r[10],
            }
            for r in rows
        ]

def create_reservation_service(payload, user):
    with db_connection() as conn:
        try:
            with conn.cursor() as cur:

                # =========================================================
                # 🔎 VALIDAR SOLICITUD APROBADA
                # =========================================================
                cur.execute("""
                    SELECT status, related_material_id, quantity
                    FROM material_requests
                    WHERE id = %s
                    FOR UPDATE
                """, (str(payload.material_request_id),))

                row = cur.fetchone()

                if not row:
                    raise HTTPException(404, "Solicitud no encontrada")

                status, related_material_id, requested_qty = row

                if status != "APPROVED":
                    raise HTTPException(400, "La solicitud no está APPROVED")

                if str(related_material_id) != str(payload.material_id):
                    raise HTTPException(400, "El material no coincide con la solicitud")

                if float(payload.quantity) != float(requested_qty):
                    raise HTTPException(400, "La cantidad no coincide con la solicitud")


                # 1️⃣ Consultar disponibilidad lógica
                cur.execute("""
                    SELECT stock_available
                    FROM vw_stock_availability
                    WHERE material_id = %s
                      AND warehouse_id = %s
                    FOR UPDATE
                """, (
                    str(payload.material_id),
                    str(payload.warehouse_id),
                ))

                row = cur.fetchone()
                if not row or row[0] < payload.quantity:
                    raise HTTPException(
                        400,
                        "Stock insuficiente para reservar"
                    )

                # 2️⃣ Crear reserva
                cur.execute("""
                    INSERT INTO stock_reservations (
                        material_request_id,
                        material_id,
                        warehouse_id,
                        project_id,
                        quantity,
                        reserved_by,
                        status,
                        expires_at
                    )
                    VALUES (
                        %s, %s, %s, %s,
                        %s,
                        %s,
                        'BLOCKED',
                        NOW() + INTERVAL '24 hours'
                    )
                    RETURNING id, expires_at
                """, (
                    str(payload.material_request_id), 
                    str(payload.material_id),
                    str(payload.warehouse_id),
                    str(payload.project_id) if payload.project_id else None,
                    payload.quantity,
                    str(user["id"]),
                ))

                reservation_id, expires_at = cur.fetchone()

            conn.commit()

            return {
                "id": str(reservation_id),
                "status": "BLOCKED",
                "expires_at": expires_at
            }

        except Exception:
            conn.rollback()
            raise

def list_all_reservations_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sr.id,
                    m.name          AS material_name,
                    w.name          AS warehouse_name,
                    sr.quantity,
                    sr.status,
                    u.username      AS reserved_by,
                    sr.created_at,
                    sr.expires_at,
                    sr.released_at,
                    sr.material_request_id
                FROM stock_reservations sr
                JOIN materials  m ON m.id = sr.material_id
                JOIN warehouses w ON w.id = sr.warehouse_id
                JOIN users      u ON u.id = sr.reserved_by
                ORDER BY sr.created_at DESC
            """)
            return [
                {
                    "id": str(r[0]),
                    "material_name": r[1],
                    "warehouse_name": r[2],
                    "quantity": float(r[3]),
                    "status": r[4],
                    "reserved_by": r[5],
                    "created_at": r[6],
                    "expires_at": r[7],
                    "released_at": r[8],
                    "material_request_id": str(r[9]) if r[9] else None,
                }
                for r in cur.fetchall()
            ]


def list_my_dispatches_service(user):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    sd.id,
                    sd.status,
                    sd.notes,
                    sd.created_at,
                    sd.dispatched_at,
                    sd.delivered_at,
                    sd.receipt_notes,
                    sd.recipient_name,
                    m.name          AS material_name,
                    m.code          AS material_code,
                    w.name          AS warehouse_name,
                    sr.quantity
                FROM stock_dispatches sd
                LEFT JOIN stock_reservations sr ON sr.id = sd.reservation_id
                LEFT JOIN materials  m ON m.id  = sr.material_id
                LEFT JOIN warehouses w ON w.id  = sr.warehouse_id
                WHERE sd.recipient_user_id = %s
                ORDER BY sd.created_at DESC
            """, (str(user["id"]),))

            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "status": r[1],
            "notes": r[2],
            "created_at": r[3],
            "dispatched_at": r[4],
            "delivered_at": r[5],
            "receipt_notes": r[6],
            "recipient_name": r[7],
            "material_name": r[8],
            "material_code": r[9],
            "warehouse_name": r[10],
            "quantity": float(r[11]) if r[11] is not None else None,
        }
        for r in rows
    ]


def expire_reservations_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE stock_reservations
                SET status = 'EXPIRED'
                WHERE status = 'BLOCKED'
                  AND expires_at <= NOW()
                RETURNING id
            """)
            expired = cur.fetchall()
            conn.commit()

    return {
        "expired_count": len(expired),
        "expired_ids": [str(r[0]) for r in expired]
    }

def confirm_reservation_service(reservation_id, _user):
    with db_connection() as conn:
        try:
            with conn.cursor() as cur:

                # 1️⃣ Bloquear reserva
                cur.execute("""
                    SELECT status
                    FROM stock_reservations
                    WHERE id = %s
                    FOR UPDATE
                """, (reservation_id,))

                row = cur.fetchone()

                if not row:
                    raise HTTPException(404, "Reserva no encontrada")

                status = row[0]

                if status != "BLOCKED":
                    raise HTTPException(
                        400,
                        "Solo reservas BLOCKED pueden confirmarse"
                    )

                # 2️⃣ Confirmar
                cur.execute("""
                    UPDATE stock_reservations
                    SET status = 'CONFIRMED'
                    WHERE id = %s
                """, (reservation_id,))

            conn.commit()

            return {
                "reservation_id": reservation_id,
                "status": "CONFIRMED"
            }

        except Exception:
            conn.rollback()
            raise


def release_reservation_service(reservation_id, _user):
    with db_connection() as conn:
        try:
            with conn.cursor() as cur:

                # 1️⃣ Bloquear reserva
                cur.execute("""
                    SELECT status
                    FROM stock_reservations
                    WHERE id = %s
                    FOR UPDATE
                """, (reservation_id,))

                row = cur.fetchone()

                if not row:
                    raise HTTPException(404, "Reserva no encontrada")

                status = row[0]

                if status != "BLOCKED":
                    raise HTTPException(
                        400,
                        "Solo reservas BLOCKED pueden liberarse"
                    )

                # 2️⃣ Liberar
                cur.execute("""
                    UPDATE stock_reservations
                    SET
                        status = 'RELEASED',
                        released_at = NOW()
                    WHERE id = %s
                """, (reservation_id,))

            conn.commit()

            return {
                "reservation_id": reservation_id,
                "status": "RELEASED"
            }

        except Exception:
            conn.rollback()
            raise