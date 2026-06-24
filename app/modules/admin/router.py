from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional
from uuid import UUID
from app.core.database import db_connection
from app.core.security.permissions import require_permission
from app.modules.admin.schemas import (
    UserCreate,
    UserRolesUpdate,
    UserStatusUpdate,
    RolePermissionsUpdate,
    RoleCreate,
)
from app.modules.admin.service import (
    create_user_service,
    update_user_roles_service,
    update_user_status_service,
    delete_user_service,
    list_audit_logs_service,
    export_audit_logs_excel_service,
    list_permissions_service,
    get_role_with_permissions_service,
    update_role_permissions_service,
    create_role_service,
    reset_all_data_service,
)

router = APIRouter(
    prefix="/admin",
    tags=["Admin"]
)

# Permisos de lectura: admin:users (gestión completa) O admin:audit (solo lectura)
_READ  = ["admin:users", "admin:audit"]
# Permisos de escritura: solo admin:users
_WRITE = "admin:users"


# ============================
# Crear usuario (solo admin)
# ============================
@router.post("/users")
def create_user(
    payload: UserCreate,
    current_user=Depends(require_permission(_WRITE))
):
    return create_user_service(payload)


# ============================
# Listar usuarios (frontend)
# ============================
@router.get("/users")
def list_users(
    current_user=Depends(require_permission(_READ))
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT
                    u.id,
                    u.username,
                    u.email,
                    u.is_active,
                    array_agg(r.name) AS roles
                FROM users u
                LEFT JOIN user_roles ur ON ur.user_id = u.id
                LEFT JOIN roles r ON r.id = ur.role_id
                GROUP BY u.id
                ORDER BY u.username
            """)
            return [
                {
                    "id": r[0],
                    "username": r[1],
                    "email": r[2],
                    "is_active": r[3],
                    "roles": r[4] or [],
                }
                for r in cur.fetchall()
            ]


# ============================
# Listar roles (dropdown frontend)
# ============================
@router.get("/roles")
def list_roles(
    current_user=Depends(require_permission(_READ))
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name
                FROM roles
                ORDER BY name
            """)
            return [
                {"id": row[0], "name": row[1]}
                for row in cur.fetchall()
            ]


# ============================
# Eliminar usuario
# ============================
@router.delete("/users/{user_id}")
def delete_user(
    user_id: UUID,
    current_user=Depends(require_permission(_WRITE))
):
    if current_user.get("primary_module") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Solo el Administrador Maestro (TI) puede eliminar usuarios"
        )
    if str(user_id) == str(current_user["id"]):
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propio usuario")
    try:
        return delete_user_service(str(user_id), str(current_user["id"]))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================
# Actualizar roles de usuario
# ============================
@router.put("/users/{user_id}/roles")
def update_user_roles(
    user_id: UUID,
    payload: UserRolesUpdate,
    current_user=Depends(require_permission(_WRITE))
):
    try:
        update_user_roles_service(user_id, payload.role_ids)
        return {"status": "roles updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================
# Activar / desactivar usuario
# ============================
@router.patch("/users/{user_id}/status")
def update_user_status(
    user_id: UUID,
    payload: UserStatusUpdate,
    current_user=Depends(require_permission(_WRITE))
):
    if str(user_id) == str(current_user["id"]):
        raise HTTPException(
            status_code=400,
            detail="No puedes modificar tu propio usuario"
        )

    try:
        update_user_status_service(user_id, payload.is_active)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


# ============================
# Permisos disponibles
# ============================
@router.get("/permissions")
def list_permissions(
    _=Depends(require_permission(_READ))
):
    return list_permissions_service()


# ============================
# Gestión de permisos por rol
# ============================
@router.get("/roles/{role_id}")
def get_role(
    role_id: str,
    _=Depends(require_permission(_READ))
):
    try:
        return get_role_with_permissions_service(role_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/roles/{role_id}/permissions")
def update_role_permissions(
    role_id: str,
    payload: RolePermissionsUpdate,
    _=Depends(require_permission(_WRITE))
):
    try:
        update_role_permissions_service(role_id, payload.permission_codes)
        return {"status": "updated"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/roles")
def create_role(
    payload: RoleCreate,
    _=Depends(require_permission(_WRITE))
):
    return create_role_service(payload.name)


@router.delete("/roles/{role_id}")
def delete_role(
    role_id: str,
    current_user=Depends(require_permission(_WRITE))
):
    if current_user.get("primary_module") != "admin":
        raise HTTPException(
            status_code=403,
            detail="Solo el Administrador Maestro (TI) puede eliminar roles"
        )
    try:
        from app.modules.admin.service import delete_role_service
        return delete_role_service(role_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/roles/{role_id}/users")
def list_role_users(
    role_id: str,
    _=Depends(require_permission(_READ))
):
    from app.modules.admin.service import list_role_users_service
    return list_role_users_service(role_id)


@router.post("/roles/{role_id}/users/{user_id}")
def add_user_to_role(
    role_id: str,
    user_id: str,
    _=Depends(require_permission(_WRITE))
):
    try:
        from app.modules.admin.service import add_user_to_role_service
        return add_user_to_role_service(role_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/roles/{role_id}/users/{user_id}")
def remove_user_from_role(
    role_id: str,
    user_id: str,
    _=Depends(require_permission(_WRITE))
):
    try:
        from app.modules.admin.service import remove_user_from_role_service
        return remove_user_from_role_service(role_id, user_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================
# Reset total del ERP
# ============================
@router.post(
    "/reset-all",
    dependencies=[Depends(require_permission("admin:users"))]
)
def reset_all_data():
    return reset_all_data_service()


# ============================
# Auditoría (admin)
# ============================
@router.get("/audit-logs/export")
def export_audit_logs(
    username: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    _=Depends(require_permission("admin:audit")),
):
    return export_audit_logs_excel_service(
        username=username, module=module, method=method,
        fecha_inicio=fecha_inicio, fecha_fin=fecha_fin,
    )


@router.get("/audit-logs")
def list_audit_logs(
    limit: int = Query(500, ge=1, le=10000),
    username: Optional[str] = Query(None),
    module: Optional[str] = Query(None),
    method: Optional[str] = Query(None),
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    _=Depends(require_permission("admin:audit")),
):
    return list_audit_logs_service(
        limit=limit,
        username=username,
        module=module,
        method=method,
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
    )
