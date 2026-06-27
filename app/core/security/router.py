from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
import os
from app.core.database import db_connection
from app.core.rate_limit import limiter
from app.core.security.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    store_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    get_user_permissions,
    get_user_primary_module,
    get_user_modules,
)
from app.core.security.dependencies import get_current_user
from app.core.security.preferences_service import (
    get_user_preferences,
    update_user_preferences,
)

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

class RefreshTokenRequest(BaseModel):
    refresh_token: str
class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login")
@limiter.limit("10/minute")
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(
        username=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    # 🔐 Crear access token
    access_token = create_access_token(
        user_id=str(user["id"]),
        permissions=user["permissions"],
        primary_module=user["primary_module"],
        modules=user.get("modules", [user["primary_module"]]),
        role=user.get("role"),
    )

    # El superadmin no tiene refresh token (no existe en ninguna DB de tenant)
    if user.get("role") == "superadmin":
        return {
            "access_token": access_token,
            "token_type": "bearer"
        }

    # 🔐 Crear refresh token para usuarios normales
    refresh_token = create_refresh_token()
    store_refresh_token(str(user["id"]), refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer"
    }

@router.post("/refresh")
def refresh_token_endpoint(payload: RefreshTokenRequest):

    result = rotate_refresh_token(payload.refresh_token)

    if not result:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id, new_refresh = result

    permissions = get_user_permissions(user_id)
    modules = get_user_modules(user_id)
    primary_module = modules[0] if modules else "operations"

    new_access = create_access_token(
        user_id=str(user_id),
        permissions=permissions,
        primary_module=primary_module,
        modules=modules,
    )

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer"
    }

@router.post("/logout")
def logout(payload: LogoutRequest):
    success = revoke_refresh_token(payload.refresh_token)

    if not success:
        raise HTTPException(status_code=400, detail="Invalid or already revoked token")

    return {"message": "Logged out successfully"}


@router.get("/me")
def me(current_user=Depends(get_current_user)):
    """
    Devuelve el usuario autenticado con sus permisos.
    Útil para que el frontend hidrate el contexto de sesión.
    """
    return {
        "id": current_user["id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "permissions": current_user["permissions"],
        "avatar_url": current_user.get("avatar_url"),
    }


_AVATARS_DIR = os.path.join("app", "storage", "avatars")


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in (".png", ".jpg", ".jpeg"):
        raise HTTPException(status_code=422, detail="Formato no soportado (usar PNG o JPG)")
    
    # Validar tamaño (máximo 2 MB)
    content = file.file.read()
    if len(content) > 2 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="El archivo supera 2 MB")
        
    os.makedirs(_AVATARS_DIR, exist_ok=True)
    
    # Nombre de archivo basado en el user_id para que sea único y reemplace el anterior
    user_id = str(current_user["id"])
    filename = f"{user_id}{ext}"
    dest = os.path.join(_AVATARS_DIR, filename)
    
    # Borrar cualquier extensión anterior para evitar basura
    for e in (".png", ".jpg", ".jpeg"):
        prev = os.path.join(_AVATARS_DIR, f"{user_id}{e}")
        if prev != dest and os.path.exists(prev):
            try:
                os.remove(prev)
            except OSError:
                pass
                
    # Guardar
    with open(dest, "wb") as f:
        f.write(content)
        
    url = f"/avatar-assets/{filename}"
    
    # Guardar en base de datos
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET avatar_url = %s
                WHERE id = %s
            """, (url, user_id))
        conn.commit()
        
    return {"status": "ok", "avatar_url": url}


class AvatarUpdate(BaseModel):
    avatar_url: str


@router.put("/me/avatar")
def update_avatar_url(
    payload: AvatarUpdate,
    current_user=Depends(get_current_user)
):
    user_id = str(current_user["id"])
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET avatar_url = %s
                WHERE id = %s
            """, (payload.avatar_url, user_id))
        conn.commit()
    return {"status": "ok", "avatar_url": payload.avatar_url}


# ── Preferencias del usuario (incluye el tema de la interfaz) ──────────────────
# Rutas literales /me/preferences: dato propio del usuario (solo-auth), mismo
# patrón que los endpoints "/my"; no requiere require_permission.

@router.get("/me/preferences")
def get_preferences(current_user=Depends(get_current_user)):
    return get_user_preferences(current_user["id"])


@router.put("/me/preferences")
def put_preferences(payload: dict, current_user=Depends(get_current_user)):
    try:
        return update_user_preferences(current_user["id"], payload or {})
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
