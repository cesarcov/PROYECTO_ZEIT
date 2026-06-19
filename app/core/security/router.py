from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
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

router = APIRouter(
    prefix="/auth",
    tags=["Auth"]
)

class RefreshTokenRequest(BaseModel):
    refresh_token: str
class LogoutRequest(BaseModel):
    refresh_token: str


@router.post("/login")
def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(
        username=form_data.username,
        password=form_data.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales inválidas"
        )

    # 🔐 Crear refresh token
    refresh_token = create_refresh_token()
    store_refresh_token(str(user["id"]), refresh_token)

    # 🔐 Crear access token
    access_token = create_access_token(
        user_id=str(user["id"]),
        permissions=user["permissions"],
        primary_module=user["primary_module"],
        modules=user.get("modules", [user["primary_module"]]),
    )

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
    }
