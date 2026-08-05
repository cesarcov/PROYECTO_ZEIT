from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from app.core.config import settings
from app.core.database import db_connection
from app.core.db import get_conn
from app.core.login_guard import registrar_exito, registrar_fallo, segundos_de_bloqueo
from app.core.rate_limit import limiter
from app.core.storage import ArchivoInvalido, obtener_almacen, validar_y_normalizar
from app.core.security.auth import (
    authenticate_user,
    create_access_token,
    create_refresh_token,
    store_refresh_token,
    rotate_refresh_token,
    revoke_refresh_token,
    get_user_permissions,
    get_user_modules,
    get_user_blocks,
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
@limiter.limit(settings.LOGIN_RATE_LIMIT)
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    """Autentica al usuario. F-000 / T-14.

    Dos frenos complementarios contra la fuerza bruta:
      · el decorador limita por IP (5/min por defecto);
      · `login_guard` bloquea por USUARIO con espera creciente, así que
        cambiar de IP no ayuda al atacante.
    """
    espera = segundos_de_bloqueo(form_data.username)
    if espera:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                "Demasiados intentos fallidos. "
                f"Vuelve a intentarlo en {espera} segundo(s)."
            ),
            headers={"Retry-After": str(espera)},
        )

    user = authenticate_user(
        username=form_data.username,
        password=form_data.password
    )

    if not user:
        registrar_fallo(form_data.username)
        # El mensaje es idéntico para usuario inexistente y contraseña
        # incorrecta: revelar la diferencia permite enumerar cuentas.
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    registrar_exito(form_data.username)

    # 🔐 Crear access token
    access_token = create_access_token(
        user_id=str(user["id"]),
        permissions=user["permissions"],
        primary_module=user["primary_module"],
        modules=user.get("modules", [user["primary_module"]]),
        role=user.get("role"),
        blocks=user.get("blocks"),
    )

    # El superadmin no tiene refresh token (no existe en ninguna DB de tenant)
    if user.get("role") == "superadmin":
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "blocks": user.get("blocks"),
        }

    # 🔐 Crear refresh token para usuarios normales
    refresh_token = create_refresh_token()
    store_refresh_token(str(user["id"]), refresh_token)

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "blocks": user.get("blocks", []),
    }

@router.post("/refresh")
def refresh_token_endpoint(payload: RefreshTokenRequest):

    result = rotate_refresh_token(payload.refresh_token)

    if not result:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    user_id, new_refresh, blocks = result

    permissions = get_user_permissions(user_id)
    modules = get_user_modules(user_id)
    primary_module = modules[0] if modules else "operations"

    new_access = create_access_token(
        user_id=str(user_id),
        permissions=permissions,
        primary_module=primary_module,
        modules=modules,
        blocks=blocks,
    )

    return {
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer",
        "blocks": blocks,
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
    user_id = current_user["id"]
    blocks = "all" if current_user.get("role") == "superadmin" else get_user_blocks(str(user_id))
    return {
        "id": user_id,
        "username": current_user["username"],
        "email": current_user["email"],
        "permissions": current_user["permissions"],
        "avatar_url": current_user.get("avatar_url"),
        "full_name": current_user.get("full_name"),
        "blocks": blocks,
    }


@router.post("/me/avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user=Depends(get_current_user)
):
    """Sube el avatar del usuario. F-000 / T-11.

    El archivo se valida por su firma binaria y se re-encodea antes de
    almacenarse (RN-02), y va a Supabase Storage si está configurado, para
    sobrevivir a los redeploys de Render.
    """
    content = file.file.read()
    try:
        limpio, ext, content_type = validar_y_normalizar(content)
    except ArchivoInvalido as e:
        raise HTTPException(status_code=422, detail=str(e))

    if ext == ".svg":
        raise HTTPException(status_code=422, detail="El avatar debe ser PNG, JPG o GIF.")

    # El nombre deriva del user_id: único y reemplaza al anterior.
    user_id = str(current_user["id"])
    almacen = obtener_almacen("avatars")
    almacen.borrar_variantes(user_id, (".png", ".jpg", ".jpeg", ".gif"))
    url = almacen.subir(f"{user_id}{ext}", limpio, content_type)

    with get_conn(commit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (url, user_id))

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


class ProfileUpdate(BaseModel):
    full_name: str


@router.put("/me/profile")
def update_profile(
    payload: ProfileUpdate,
    current_user=Depends(get_current_user)
):
    user_id = str(current_user["id"])
    if not payload.full_name.strip():
        raise HTTPException(status_code=400, detail="El nombre completo no puede estar vacío.")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE users
                SET full_name = %s
                WHERE id = %s
            """, (payload.full_name.strip(), user_id))
        conn.commit()

    return {"status": "ok", "full_name": payload.full_name.strip()}


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
