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

        if not user_id:
            raise credentials_exception

    except JWTError:
        raise credentials_exception

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, email, is_active
                FROM users
                WHERE id = %s
            """, (user_id,))
            row = cur.fetchone()

    if not row or not row[3]:
        raise HTTPException(status_code=401, detail="Usuario inactivo")

    user = {
        "id": row[0],
        "email": row[1],
        "username": row[1].split("@")[0],  # o traelo directo de la DB
        "permissions": permissions,
    }


    # 🔥 CLAVE ABSOLUTA
    request.state.user = user

    return user