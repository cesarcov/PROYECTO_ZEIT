from app.core.database import db_connection
from app.core.security.hashing import hash_password
from psycopg2 import sql
from uuid import UUID


# ============================
# Crear usuario
# ============================
def create_user_service(payload):
    hashed_password = hash_password(payload.password)

    with db_connection() as conn:
        with conn.cursor() as cur:

            # 1️⃣ Crear usuario
            cur.execute("""
                INSERT INTO users (username, email, hashed_password, is_active)
                VALUES (%s, %s, %s, TRUE)
                RETURNING id
            """, (
                payload.username,
                payload.email,
                hashed_password,
            ))

            user_id = cur.fetchone()[0]

            # 2️⃣ Asignar roles
            for role_id in payload.role_ids:
                cur.execute("""
                    INSERT INTO user_roles (user_id, role_id)
                    VALUES (%s, %s)
                """, (
                    str(user_id),
                    str(role_id)
                ))

        conn.commit()

    return {"id": str(user_id)}


# ============================
# Actualizar roles de usuario
# ============================
def update_user_roles_service(user_id: UUID, role_ids: list[UUID]):
    with db_connection() as conn:
        with conn.cursor() as cur:

            # Verificar usuario
            cur.execute("SELECT id FROM users WHERE id = %s", (str(user_id),))
            if not cur.fetchone():
                raise ValueError("Usuario no existe")

            # Verificar roles
            cur.execute(
                "SELECT id FROM roles WHERE id = ANY(%s)",
                (list(map(str, role_ids)),)
            )
            found_roles = {row[0] for row in cur.fetchall()}

            if len(found_roles) != len(role_ids):
                raise ValueError("Uno o más roles no existen")

            # Borrar roles actuales
            cur.execute(
                "DELETE FROM user_roles WHERE user_id = %s",
                (str(user_id),)
            )

            # Asignar nuevos roles
            for role_id in role_ids:
                cur.execute("""
                    INSERT INTO user_roles (user_id, role_id)
                    VALUES (%s, %s)
                """, (str(user_id), str(role_id)))

        conn.commit()


# ============================
# Activar / desactivar usuario
# ============================
def update_user_status_service(user_id: UUID, is_active: bool):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET is_active = %s WHERE id = %s",
                (is_active, str(user_id))
            )

            if cur.rowcount == 0:
                raise ValueError("Usuario no existe")

        conn.commit()


# ============================
# Roles y permisos
# ============================

def list_permissions_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT code, description FROM permissions ORDER BY code")
            return [{"code": r[0], "description": r[1]} for r in cur.fetchall()]


def get_role_with_permissions_service(role_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name FROM roles WHERE id = %s", (role_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Rol no encontrado")
            cur.execute(
                "SELECT permission_code FROM role_permissions WHERE role_id = %s ORDER BY permission_code",
                (role_id,)
            )
            permissions = [r[0] for r in cur.fetchall()]
            return {"id": str(row[0]), "name": row[1], "permissions": permissions}


def update_role_permissions_service(role_id: str, permission_codes: list[str]):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM roles WHERE id = %s", (role_id,))
            if not cur.fetchone():
                raise ValueError("Rol no encontrado")
            # Verificar que todos los permisos existen
            if permission_codes:
                cur.execute(
                    "SELECT code FROM permissions WHERE code = ANY(%s)",
                    (permission_codes,)
                )
                found = {r[0] for r in cur.fetchall()}
                missing = set(permission_codes) - found
                if missing:
                    raise ValueError(f"Permisos no existen: {missing}")
            # Reemplazar todos los permisos del rol
            cur.execute("DELETE FROM role_permissions WHERE role_id = %s", (role_id,))
            for code in permission_codes:
                cur.execute(
                    "INSERT INTO role_permissions (role_id, permission_code) VALUES (%s, %s)",
                    (role_id, code)
                )
        conn.commit()


def create_role_service(name: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO roles (name) VALUES (%s) RETURNING id",
                (name,)
            )
            role_id = cur.fetchone()[0]
        conn.commit()
    return {"id": str(role_id), "name": name}


def delete_role_service(role_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM roles WHERE id = %s", (role_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Rol no encontrado")
            cur.execute("SELECT COUNT(*) FROM user_roles WHERE role_id = %s", (role_id,))
            count = cur.fetchone()[0]
            if count > 0:
                raise ValueError(f"No se puede eliminar: {count} usuario(s) tienen este rol asignado")
            cur.execute("DELETE FROM role_permissions WHERE role_id = %s", (role_id,))
            cur.execute("DELETE FROM roles WHERE id = %s", (role_id,))
        conn.commit()
    return {"status": "deleted"}


def list_role_users_service(role_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM roles WHERE id = %s", (role_id,))
            if not cur.fetchone():
                raise ValueError("Rol no encontrado")
            cur.execute("""
                SELECT u.id, u.username, u.email, u.is_active
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                WHERE ur.role_id = %s
                ORDER BY u.username
            """, (role_id,))
            return [
                {"id": str(r[0]), "username": r[1], "email": r[2], "is_active": r[3]}
                for r in cur.fetchall()
            ]


def add_user_to_role_service(role_id: str, user_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM roles WHERE id = %s", (role_id,))
            role = cur.fetchone()
            if not role:
                raise ValueError("Rol no encontrado")
            cur.execute("SELECT id FROM users WHERE id = %s", (user_id,))
            if not cur.fetchone():
                raise ValueError("Usuario no encontrado")
            # Límite de 2 para Administrador Maestro
            if role[0] == "Administrador Maestro":
                cur.execute("SELECT COUNT(*) FROM user_roles WHERE role_id = %s", (role_id,))
                if cur.fetchone()[0] >= 2:
                    raise ValueError("El rol Administrador Maestro solo puede tener un máximo de 2 usuarios")
            cur.execute(
                "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (user_id, role_id)
            )
        conn.commit()
    return {"status": "added"}


def remove_user_from_role_service(role_id: str, user_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "DELETE FROM user_roles WHERE role_id = %s AND user_id = %s",
                (role_id, user_id)
            )
            if cur.rowcount == 0:
                raise ValueError("Asignación no encontrada")
        conn.commit()
    return {"status": "removed"}


# ============================
# Eliminar usuario
# ============================
def delete_user_service(user_id: str, requester_id: str):
    """
    Elimina permanentemente un usuario.
    Bloquea si: es el propio usuario, es el último Administrador Maestro,
    o tiene registros operativos en planificación/productividad.
    """
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                raise ValueError("Usuario no encontrado")
            username = row[0]

            if user_id == requester_id:
                raise ValueError("No puedes eliminar tu propio usuario")

            # Verificar si es Administrador Maestro y si es el único
            cur.execute("""
                SELECT COUNT(*) FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE r.name = 'Administrador Maestro' AND ur.user_id = %s
            """, (user_id,))
            is_master = cur.fetchone()[0] > 0

            if is_master:
                cur.execute("""
                    SELECT COUNT(*) FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE r.name = 'Administrador Maestro' AND ur.user_id != %s
                """, (user_id,))
                other_masters = cur.fetchone()[0]
                if other_masters == 0:
                    raise ValueError("No puedes eliminar al único Administrador Maestro del sistema")

            # Verificar registros operativos (planificación y productividad)
            cur.execute("""
                SELECT COUNT(*) FROM planificacion_semanal
                WHERE responsable_id = %s OR seguimiento_id = %s
            """, (user_id, user_id))
            planif_count = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*) FROM planificacion_subtareas WHERE responsable_id = %s
            """, (user_id,))
            subtarea_count = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*) FROM registro_productividad WHERE user_id = %s
            """, (user_id,))
            prod_count = cur.fetchone()[0]

            total_data = planif_count + subtarea_count + prod_count
            if total_data > 0:
                raise ValueError(
                    f"El usuario tiene {total_data} registro(s) en planificación o productividad. "
                    f"Reasigna esos registros primero, o desactívalo para bloquearlo sin borrar."
                )

            # Eliminar en orden (sin depender de CASCADE)
            cur.execute("DELETE FROM refresh_tokens WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))

        conn.commit()
    return {"status": "deleted", "username": username}


# ============================
# Reset total del ERP (solo desarrollo / pruebas)
# ============================
def reset_all_data_service():
    """
    Borra todos los datos operativos del ERP.
    Preserva: usuarios, roles, permisos y sus asignaciones.
    """
    # Orden: primero hijos, luego padres (respeta FK constraints)
    tables_in_order = [
        "project_plan_submission_items",
        "project_plan_submissions",
        "project_plan_items",
        "project_plans",
        "material_request_audit",
        "material_request_items",
        "stock_dispatch_items",
        "stock_dispatches",
        "stock_reservations",
        "material_requests",
        "stock_movements",
        "stock_locations",
        "tool_assignments",
        "tool_maintenance",
        "material_aliases",
        "materials",
        "warehouses",
        "projects",
        "audit_logs",
        "refresh_tokens",
    ]

    deleted = {}
    with db_connection() as conn:
        with conn.cursor() as cur:
            for table in tables_in_order:
                try:
                    cur.execute("SAVEPOINT sp_reset")
                    cur.execute(sql.SQL("DELETE FROM {}").format(sql.Identifier(table)))
                    deleted[table] = cur.rowcount
                    cur.execute("RELEASE SAVEPOINT sp_reset")
                except Exception:
                    cur.execute("ROLLBACK TO SAVEPOINT sp_reset")
                    deleted[table] = "skip: tabla no existe"
        conn.commit()

    return {
        "status": "reset_complete",
        "tables_cleared": deleted,
    }


# ============================
# Auditoría
# ============================

_FRIENDLY_ACTION = {
    "GET": "Consultar",
    "POST": "Registrar",
    "PUT": "Modificar",
    "PATCH": "Modificar",
    "DELETE": "Eliminar",
}


def _friendly_action(action: str) -> str:
    method = (action or "").split(" ")[0].upper()
    return _FRIENDLY_ACTION.get(method, action or "—")


def _audit_conditions(username=None, module=None, method=None, fecha_inicio=None, fecha_fin=None):
    # Todas las condiciones son strings constantes; los valores van en params como %s.
    # No hay interpolación de input de usuario en la estructura SQL.
    conditions = []
    params = []
    if username and username != "Todos":
        conditions.append("username = %s")
        params.append(username)
    if module and module != "Todos":
        conditions.append("module = %s")
        params.append(module)
    if method and method != "Todos":
        if method == "GET":
            conditions.append("action LIKE 'GET%'")
        elif method == "POST":
            conditions.append("action LIKE 'POST%'")
        elif method == "PUT_PATCH":
            conditions.append("(action LIKE 'PUT%' OR action LIKE 'PATCH%')")
        elif method == "DELETE":
            conditions.append("action LIKE 'DELETE%'")
    if fecha_inicio:
        conditions.append("created_at >= %s::timestamp")
        params.append(f"{fecha_inicio} 00:00:00")
    if fecha_fin:
        conditions.append("created_at <= %s::timestamp")
        params.append(f"{fecha_fin} 23:59:59")
    return conditions, params


def list_audit_logs_service(
    limit: int = 500,
    username: str = None,
    module: str = None,
    method: str = None,
    fecha_inicio: str = None,
    fecha_fin: str = None,
):
    conditions, params = _audit_conditions(username, module, method, fecha_inicio, fecha_fin)
    params.append(limit)

    base = sql.SQL("""
        SELECT username, action, endpoint, module, ip_address, created_at
        FROM audit_logs
        {where}
        ORDER BY created_at DESC
        LIMIT %s
    """)
    if conditions:
        where_clause = sql.SQL("WHERE ") + sql.SQL(" AND ").join(
            sql.SQL(c) for c in conditions
        )
    else:
        where_clause = sql.SQL("")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(base.format(where=where_clause), params)
            return [
                {
                    "username": r[0],
                    "action": r[1],
                    "endpoint": r[2],
                    "module": r[3],
                    "ip": r[4],
                    "created_at": r[5],
                }
                for r in cur.fetchall()
            ]


def export_audit_logs_excel_service(
    username: str = None,
    module: str = None,
    method: str = None,
    fecha_inicio: str = None,
    fecha_fin: str = None,
    limit: int = 10000,
):
    from datetime import datetime
    from app.core.export_utils import (
        write_title_row, write_header_row, write_data_row,
        set_column_widths, excel_response,
    )
    import openpyxl

    logs = list_audit_logs_service(
        limit=limit,
        username=username,
        module=module,
        method=method,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Auditoría"

    headers = [
        "Fecha", "Hora", "Usuario", "Acción", "Módulo",
        "Ruta del sistema", "Dirección IP",
    ]
    widths = [12, 10, 20, 14, 14, 42, 16]
    write_title_row(ws, f"CeShark ERP — Registro de Auditoría — {fecha}", len(headers))
    write_header_row(ws, headers, row=2)
    set_column_widths(ws, widths)
    ws.row_dimensions[2].height = 18

    for i, log in enumerate(logs, start=1):
        dt = log.get("created_at")
        fecha_str = dt.strftime("%d/%m/%Y") if dt else ""
        hora_str = dt.strftime("%H:%M:%S") if dt else ""
        write_data_row(ws, i + 2, [
            fecha_str,
            hora_str,
            log.get("username") or "anónimo",
            _friendly_action(log.get("action")),
            log.get("module") or "—",
            log.get("endpoint") or "—",
            log.get("ip") or "—",
        ], alternate=(i % 2 == 0))

    return excel_response(wb, f"auditoria_{datetime.now().strftime('%Y%m%d')}.xlsx")


def reset_user_password_service(user_id: str, new_password: str):
    hashed_password = hash_password(new_password)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE users SET hashed_password = %s WHERE id = %s",
                (hashed_password, user_id)
            )
            if cur.rowcount == 0:
                raise ValueError("Usuario no encontrado")
        conn.commit()
    return {"status": "password reset successfully"}


def impersonate_user_service(user_id: str):
    from app.core.security.auth import (
        _compute_modules,
        create_access_token,
        create_refresh_token,
        store_refresh_token,
    )
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, email, is_active FROM users WHERE id = %s",
                (user_id,)
            )
            row = cur.fetchone()
            if not row:
                raise ValueError("Usuario no encontrado")
            
            target_id, target_username, target_email, is_active = row
            if not is_active:
                raise ValueError("El usuario objetivo está inactivo")
            
            # Obtener permisos
            cur.execute("""
                SELECT DISTINCT rp.permission_code
                FROM user_roles ur
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            permissions = [r[0] for r in cur.fetchall()]

            # Obtener nombres de roles
            cur.execute("""
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            role_names = [r[0] for r in cur.fetchall()]

    modules = _compute_modules(role_names)
    primary_module = modules[0] if modules else "operations"

    # Generar tokens
    access_token = create_access_token(
        user_id=str(target_id),
        permissions=permissions,
        primary_module=primary_module,
        modules=modules
    )
    refresh_token = create_refresh_token()
    store_refresh_token(str(target_id), refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

