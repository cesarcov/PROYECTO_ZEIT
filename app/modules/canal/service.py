from datetime import datetime
from typing import Optional
from fastapi import HTTPException
from app.core.database import db_connection
from app.core.utils import generate_sequential_code

VALID_MODULES = ["operations", "logistics", "administracion", "admin"]
VALID_PRIORITIES = ["URGENTE", "ALTA", "NORMAL", "BAJA"]
VALID_STATUSES = ["PENDIENTE", "EN_REVISION", "RESUELTO", "RECHAZADO", "CANCELADO"]

MODULE_LABELS = {
    "operations":     "Operaciones",
    "logistics":      "Logística",
    "administracion": "Administración",
    "admin":          "Admin. Maestro",
}


def _gen_code(conn) -> str:
    return generate_sequential_code(conn, "canal_solicitudes", "SOL")


def _row_to_dict(r) -> dict:
    return {
        "id": r[0],
        "code": r[1],
        "from_module": r[2],
        "from_module_label": MODULE_LABELS.get(r[2], r[2]),
        "to_module": r[3],
        "to_module_label": MODULE_LABELS.get(r[3], r[3]),
        "subject": r[4],
        "description": r[5],
        "priority": r[6],
        "status": r[7],
        "created_at": r[8],
        "updated_at": r[9],
        "created_by_username": r[10],
        "message_count": int(r[11]),
        "assigned_to": str(r[12]) if len(r) > 12 and r[12] else None,
        "assigned_to_username": r[13] if len(r) > 13 and r[13] else None,
    }



def list_solicitudes_service(user: dict) -> list:
    module = user.get("primary_module", "administracion")

    with db_connection() as conn:
        with conn.cursor() as cur:
            if module == "admin":
                cur.execute("""
                    SELECT cs.id, cs.code, cs.from_module, cs.to_module, cs.subject,
                           cs.description, cs.priority, cs.status,
                           cs.created_at, cs.updated_at, u.username,
                           COUNT(cm.id) AS message_count,
                           cs.assigned_to, ua.username AS assigned_to_username
                    FROM canal_solicitudes cs
                    LEFT JOIN users u ON u.id = cs.created_by
                    LEFT JOIN users ua ON ua.id = cs.assigned_to
                    LEFT JOIN canal_mensajes cm ON cm.solicitud_id = cs.id
                    GROUP BY cs.id, u.username, ua.username
                    ORDER BY cs.updated_at DESC
                """)
            else:
                cur.execute("""
                    SELECT cs.id, cs.code, cs.from_module, cs.to_module, cs.subject,
                           cs.description, cs.priority, cs.status,
                           cs.created_at, cs.updated_at, u.username,
                           COUNT(cm.id) AS message_count,
                           cs.assigned_to, ua.username AS assigned_to_username
                    FROM canal_solicitudes cs
                    LEFT JOIN users u ON u.id = cs.created_by
                    LEFT JOIN users ua ON ua.id = cs.assigned_to
                    LEFT JOIN canal_mensajes cm ON cm.solicitud_id = cs.id
                    WHERE cs.from_module = %s OR cs.to_module = %s
                    GROUP BY cs.id, u.username, ua.username
                    ORDER BY cs.updated_at DESC
                """, (module, module))
            rows = cur.fetchall()

    return [_row_to_dict(r) for r in rows]


def get_solicitud_service(solicitud_id: int, user: dict) -> dict:
    module = user.get("primary_module", "administracion")

    with db_connection() as conn:
        with conn.cursor() as cur:
            if module == "admin":
                cur.execute("""
                    SELECT cs.id, cs.code, cs.from_module, cs.to_module, cs.subject,
                           cs.description, cs.priority, cs.status,
                           cs.created_at, cs.updated_at, u.username,
                           COUNT(cm.id) AS message_count,
                           cs.assigned_to, ua.username AS assigned_to_username
                    FROM canal_solicitudes cs
                    LEFT JOIN users u ON u.id = cs.created_by
                    LEFT JOIN users ua ON ua.id = cs.assigned_to
                    LEFT JOIN canal_mensajes cm ON cm.solicitud_id = cs.id
                    WHERE cs.id = %s
                    GROUP BY cs.id, u.username, ua.username
                """, (solicitud_id,))
            else:
                cur.execute("""
                    SELECT cs.id, cs.code, cs.from_module, cs.to_module, cs.subject,
                           cs.description, cs.priority, cs.status,
                           cs.created_at, cs.updated_at, u.username,
                           COUNT(cm.id) AS message_count,
                           cs.assigned_to, ua.username AS assigned_to_username
                    FROM canal_solicitudes cs
                    LEFT JOIN users u ON u.id = cs.created_by
                    LEFT JOIN users ua ON ua.id = cs.assigned_to
                    LEFT JOIN canal_mensajes cm ON cm.solicitud_id = cs.id
                    WHERE cs.id = %s AND (cs.from_module = %s OR cs.to_module = %s)
                    GROUP BY cs.id, u.username, ua.username
                """, (solicitud_id, module, module))


            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Solicitud no encontrada")

            sol = _row_to_dict(row)

            cur.execute("""
                SELECT cm.id, cm.mensaje, cm.created_at, u.username
                FROM canal_mensajes cm
                LEFT JOIN users u ON u.id = cm.user_id
                WHERE cm.solicitud_id = %s
                ORDER BY cm.created_at ASC
            """, (solicitud_id,))
            msgs = cur.fetchall()

    sol["mensajes"] = [
        {"id": r[0], "mensaje": r[1], "created_at": r[2], "username": r[3]}
        for r in msgs
    ]
    return sol


def create_solicitud_service(payload, user: dict) -> dict:
    if payload.to_module not in VALID_MODULES:
        raise HTTPException(400, f"Módulo destino inválido. Opciones: {', '.join(VALID_MODULES)}")

    from_module = user.get("primary_module", "administracion")
    if from_module == payload.to_module:
        raise HTTPException(400, "No puedes enviarte solicitudes a tu propio módulo")

    with db_connection() as conn:
        code = _gen_code(conn)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO canal_solicitudes
                    (code, from_module, to_module, subject, description, priority, created_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id, code, from_module, to_module, subject, description,
                          priority, status, created_at, updated_at
            """, (
                code,
                from_module,
                payload.to_module,
                payload.subject.strip(),
                payload.description,
                payload.priority or "NORMAL",
                user["id"],
            ))
            row = cur.fetchone()
            conn.commit()

    return {
        "id": row[0], "code": row[1],
        "from_module": row[2], "from_module_label": MODULE_LABELS.get(row[2], row[2]),
        "to_module": row[3], "to_module_label": MODULE_LABELS.get(row[3], row[3]),
        "subject": row[4], "description": row[5],
        "priority": row[6], "status": row[7],
        "created_at": row[8], "updated_at": row[9],
        "created_by_username": user.get("username"),
        "message_count": 0,
    }


def update_status_service(solicitud_id: int, status: str, user: dict) -> dict:
    if status not in VALID_STATUSES:
        raise HTTPException(400, f"Estado inválido. Opciones: {', '.join(VALID_STATUSES)}")

    module = user.get("primary_module", "administracion")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, from_module, to_module FROM canal_solicitudes WHERE id = %s",
                (solicitud_id,)
            )
            sol = cur.fetchone()
            if not sol:
                raise HTTPException(404, "Solicitud no encontrada")
            if module not in (sol[1], sol[2]) and module != "admin":
                raise HTTPException(403, "No tienes acceso a esta solicitud")

            resolved_clause = ", resolved_at = NOW()" if status in ("RESUELTO", "RECHAZADO") else ""
            cur.execute(f"""
                UPDATE canal_solicitudes
                SET status = %s, updated_at = NOW(){resolved_clause}
                WHERE id = %s
                RETURNING id, status, updated_at
            """, (status, solicitud_id))
            row = cur.fetchone()
            conn.commit()

    return {"id": row[0], "status": row[1], "updated_at": row[2]}


def add_mensaje_service(solicitud_id: int, mensaje: str, user: dict) -> dict:
    module = user.get("primary_module", "administracion")

    with db_connection() as conn:
        with conn.cursor() as cur:
            if module == "admin":
                cur.execute(
                    "SELECT id FROM canal_solicitudes WHERE id = %s",
                    (solicitud_id,)
                )
            else:
                cur.execute(
                    "SELECT id FROM canal_solicitudes WHERE id = %s AND (from_module = %s OR to_module = %s)",
                    (solicitud_id, module, module)
                )
            if not cur.fetchone():
                raise HTTPException(404, "Solicitud no encontrada o sin acceso")

            cur.execute("""
                INSERT INTO canal_mensajes (solicitud_id, user_id, mensaje)
                VALUES (%s, %s, %s)
                RETURNING id, mensaje, created_at
            """, (solicitud_id, user["id"], mensaje.strip()))
            row = cur.fetchone()

            # Auto-cambiar a EN_REVISION si el destino responde y estaba PENDIENTE
            cur.execute("""
                UPDATE canal_solicitudes
                SET status = 'EN_REVISION', updated_at = NOW()
                WHERE id = %s AND status = 'PENDIENTE'
            """, (solicitud_id,))
            conn.commit()

    return {
        "id": row[0],
        "mensaje": row[1],
        "created_at": row[2],
        "username": user.get("username"),
    }


def count_pending_service(user: dict) -> dict:
    module = user.get("primary_module", "administracion")
    with db_connection() as conn:
        with conn.cursor() as cur:
            if module == "admin":
                cur.execute("SELECT COUNT(*) FROM canal_solicitudes WHERE status = 'PENDIENTE'")
            else:
                cur.execute(
                    "SELECT COUNT(*) FROM canal_solicitudes WHERE to_module = %s AND status = 'PENDIENTE'",
                    (module,)
                )
            count = cur.fetchone()[0]
    return {"count": int(count)}


def assign_solicitud_service(solicitud_id: int, assigned_to: Optional[str], user: dict) -> dict:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, to_module FROM canal_solicitudes WHERE id = %s",
                (solicitud_id,)
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Solicitud no encontrada")
            sol_id, to_module = row[0], row[1]

            is_admin = user.get("role") == "admin"
            username = user.get("username", "")

            is_boss = False
            if to_module == "administracion" and username == "juliet_alvis":
                is_boss = True
            elif to_module == "operations" and username == "wilfredo_flores":
                is_boss = True
            elif to_module == "logistics" and username == "cesar_huamani":
                is_boss = True
            elif to_module == "gerente" and username == "frank_sonco":
                is_boss = True
            elif to_module == "admin" and is_admin:
                is_boss = True

            if not (is_admin or is_boss):
                raise HTTPException(403, "Solo el encargado del área o un administrador puede asignar esta solicitud")

            cur.execute("""
                UPDATE canal_solicitudes
                SET assigned_to = %s, updated_at = NOW()
                WHERE id = %s
            """, (assigned_to or None, solicitud_id))
            conn.commit()

    return get_solicitud_service(solicitud_id, user)

