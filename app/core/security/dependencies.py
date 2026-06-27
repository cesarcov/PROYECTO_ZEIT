from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from app.core.config import settings
from app.core.database import db_connection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme)
):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales inválidas",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        user_id: str = payload.get("sub")
        permissions: list[str] = payload.get("permissions", [])
        primary_module: str = payload.get("primary_module", "administracion")
        role: str | None = payload.get("role")

        if not user_id:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    # Superadmin: token especial, no existe en ninguna DB de tenant
    if role == "superadmin":
        user = {
            "id": "superadmin",
            "username": "superadmin",
            "email": None,
            "permissions": permissions,
            "primary_module": primary_module,
            "role": "superadmin",
        }
        request.state.user = user
        return user

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, email, is_active, avatar_url
                FROM users
                WHERE id = %s
            """, (user_id,))
            row = cur.fetchone()

    if not row or not row[3]:
        raise HTTPException(status_code=401, detail="Usuario inactivo")

    user = {
        "id": row[0],
        "username": row[1],
        "email": row[2],
        "permissions": permissions,
        "primary_module": primary_module,
        "avatar_url": row[4] if len(row) > 4 else None,
    }

    request.state.user = user

    return user