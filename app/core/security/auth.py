from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings
from app.core.database import db_connection
from app.core.security.hashing import verify_password

# ===============================
# JWT CONFIG
# ===============================
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60


# ===============================
# AUTHENTICATE USER
# ===============================
def authenticate_user(username: str, password: str):
    """
    1. Busca el usuario
    2. Verifica contraseña
    3. Obtiene permisos
    4. Devuelve user + permissions
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, hashed_password, is_active
                FROM users
                WHERE username = %s
            """, (username,))
            user = cur.fetchone()

            if not user:
                return None

            user_id, username, hashed_password, is_active = user

            if not is_active:
                return None

            if not verify_password(password, hashed_password):
                return None

            # Obtener permisos
            cur.execute("""
                SELECT DISTINCT rp.permission_code
                FROM user_roles ur
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))

            permissions = [r[0] for r in cur.fetchall()]

    return {
        "id": user_id,
        "username": username,
        "permissions": permissions,
    }

def create_access_token(
    user_id: str,
    permissions: list[str],
    expires_delta: timedelta | None = None
):
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": user_id,
        "permissions": permissions,
        "iat": datetime.utcnow(),
        "exp": expire,
    }

    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def get_user_permissions(user_id: str) -> list[str]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT DISTINCT rp.permission_code
                FROM user_roles ur
                JOIN role_permissions rp ON rp.role_id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            return [r[0] for r in cur.fetchall()]