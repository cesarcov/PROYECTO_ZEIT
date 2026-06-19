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

def create_material_request_service(payload, user):
    request_id = uuid4()
    sla_due_at = datetime.utcnow() + timedelta(hours=72)

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
                str(payload.related_material_id),
                payload.quantity,
                payload.reason,
                sla_due_at,
                str(payload.project_id)
            ))

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
                    m.name AS material_name,
                    mr.quantity,
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
                JOIN materials m ON m.id = mr.related_material_id
                LEFT JOIN projects p ON p.id = mr.project_id
                WHERE mr.requested_by = %s
                ORDER BY mr.created_at DESC
            """, (str(user["id"]),))

            rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "material_name": r[1],
                "quantity": float(r[2]),
                "reason": r[3],
                "status": r[4],
                "priority": r[5],
                "needed_by": r[6],
                "created_at": r[7],
                "approved_by": r[8],
                "approved_at": r[9],
                "project_id": str(r[10]) if r[10] else None,
                "project_name": r[11],
            }
            for r in rows
        ]



def list_all_material_requests_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    mr.id,
                    mr.related_material_id AS material_id,
                    m.name                 AS material_name,
                    mr.quantity,
                    mr.reason,
                    mr.status,
                    mr.priority,
                    mr.sla_due_at,
                    mr.created_at,
                    mr.approved_at,
                    mr.rejected_at,
                    u.username             AS requested_by,
                    mr.project_id,
                    p.name                 AS project_name
                FROM material_requests mr
                JOIN materials m ON m.id = mr.related_material_id
                JOIN users u     ON u.id = mr.requested_by
                LEFT JOIN projects p ON p.id = mr.project_id
                ORDER BY mr.created_at DESC
            """)
            rows = cur.fetchall()

        return [
            {
                "id": r[0],
                "material_id": str(r[1]),
                "material_name": r[2],
                "quantity": float(r[3]),
                "reason": r[4],
                "status": r[5],
                "priority": r[6],
                "sla_due_at": r[7],
                "created_at": r[8],
                "approved_at": r[9],
                "rejected_at": r[10],
                "requested_by": r[11],
                "project_id": str(r[12]) if r[12] else None,
                "project_name": r[13],
            }
            for r in rows
        ]






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

            conn.commit()

            return {
                "id": request_id,
                "status": "APPROVED"
            }

    except psycopg2.Error as e:
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

            conn.commit()

            return {
                "id": request_id,
                "status": "REJECTED",
                "rejected_at": datetime.utcnow()
            }

        except Exception:
            conn.rollback()
            raise

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