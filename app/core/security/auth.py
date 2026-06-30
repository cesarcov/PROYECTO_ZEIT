from datetime import datetime, timedelta
from jose import jwt
from app.core.config import settings
from app.core.database import db_connection
from app.core.security.hashing import verify_password
import hashlib
import secrets


def get_user_blocks(user_id: str) -> list[dict]:
    """Retorna los bloques asignados al usuario. Nunca lanza excepción; retorna [] si no hay filas."""
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT block_slug, level FROM user_block_permissions WHERE user_id = %s",
                    (user_id,),
                )
                return [{"slug": row[0], "level": row[1]} for row in cur.fetchall()]
    except Exception:
        return []

# ===============================
# JWT CONFIG
# ===============================
SECRET_KEY = settings.SECRET_KEY
REFRESH_TOKEN_EXPIRE_DAYS = 7

# ===============================
# AUTHENTICATE USER
# ===============================
def _compute_modules(role_names: list[str]) -> list[str]:
    """Retorna TODOS los módulos accesibles basado en los nombres de roles del usuario."""
    modules = []
    if any("Maestro" in r for r in role_names):
        modules.append("admin")
    if any("Gerente General" in r for r in role_names):
        modules.append("gerente")
    if any("Logístic" in r or "Logistic" in r for r in role_names):
        modules.append("logistics")
    if any("Operacion" in r or "Operación" in r or "Campo" in r or "Supervisor" in r or "Ingeniero" in r for r in role_names):
        modules.append("operations")
    # administracion: sólo si ningún otro módulo de mayor jerarquía aplica (excepto gerente que puede coexistir)
    if "admin" not in modules and any(
        ("Administrador" in r and "Maestro" not in r) or "Asistente" in r or "Auditor" in r
        for r in role_names
    ):
        modules.append("administracion")
    return modules if modules else ["administracion"]


def _compute_primary_module(role_names: list[str]) -> str:
    """Módulo principal (primer elemento de _compute_modules). Mantenido por compatibilidad."""
    return _compute_modules(role_names)[0]


def authenticate_user(username: str, password: str):
    """
    1. Busca el usuario
    2. Verifica contraseña
    3. Obtiene permisos y nombres de roles
    4. Determina primary_module para routing del frontend
    5. Devuelve user + permissions + primary_module
    """
    # Rama superadmin: credenciales en env, no en DB de ningún tenant
    if settings.SUPERADMIN_USERNAME and username == settings.SUPERADMIN_USERNAME:
        if verify_password(password, settings.SUPERADMIN_PASSWORD_HASH):
            return {
                "id": "superadmin",
                "username": "superadmin",
                "role": "superadmin",
                "tenant": "__master__",
                "permissions": ["superadmin:*"],
                "primary_module": "superadmin",
                "modules": ["superadmin"],
                "blocks": "all",
            }
        return None

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, username, hashed_password, is_active
                FROM users
                WHERE username = %s OR email = %s
            """, (username, username))
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

            # Obtener nombres de roles para determinar primary_module
            cur.execute("""
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            role_names = [r[0] for r in cur.fetchall()]

    modules = _compute_modules(role_names)
    primary_module = modules[0]
    blocks = get_user_blocks(str(user_id))

    return {
        "id": user_id,
        "username": username,
        "permissions": permissions,
        "primary_module": primary_module,
        "modules": modules,
        "blocks": blocks,
    }

def create_access_token(
    user_id: str,
    permissions: list[str],
    primary_module: str = "operations",
    modules: list[str] | None = None,
    expires_delta: timedelta | None = None,
    role: str | None = None,
    blocks: list | str | None = None,
):
    expire = datetime.utcnow() + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    payload = {
        "sub": user_id,
        "permissions": permissions,
        "primary_module": primary_module,
        "modules": modules or [primary_module],
        "blocks": blocks if blocks is not None else [],
        "iat": datetime.utcnow(),
        "exp": expire,
    }
    if role:
        payload["role"] = role

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


def get_user_primary_module(user_id: str) -> str:
    """Obtiene el primary_module de un usuario por ID (usado en refresh token)."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            role_names = [r[0] for r in cur.fetchall()]
    return _compute_primary_module(role_names)


def get_user_modules(user_id: str) -> list[str]:
    """Retorna todos los módulos accesibles de un usuario por ID (usado en refresh token)."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT r.name
                FROM user_roles ur
                JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = %s
            """, (user_id,))
            role_names = [r[0] for r in cur.fetchall()]
    return _compute_modules(role_names)

def create_refresh_token() -> str:
    """
    Genera token seguro aleatorio
    """
    return secrets.token_urlsafe(64)

def store_refresh_token(user_id: str, refresh_token: str):
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    expires_at = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

    with db_connection() as conn:
        with conn.cursor() as cur:

            # 🔎 Contar sesiones activas
            cur.execute("""
                SELECT id
                FROM refresh_tokens
                WHERE user_id = %s
                  AND revoked = FALSE
                ORDER BY issued_at ASC
            """, (user_id,))

            active_tokens = cur.fetchall()

            # 🔥 Si hay más de 2, revocar el más antiguo
            if len(active_tokens) >= 2:
                oldest_id = active_tokens[0][0]

                cur.execute("""
                    UPDATE refresh_tokens
                    SET revoked = TRUE,
                        revoked_at = NOW()
                    WHERE id = %s
                """, (oldest_id,))

            # ✅ Insertar nuevo
            cur.execute("""
                INSERT INTO refresh_tokens (
                    user_id,
                    token_hash,
                    expires_at
                )
                VALUES (%s, %s, %s)
            """, (user_id, token_hash, expires_at))

        conn.commit()

def rotate_refresh_token(refresh_token: str):
    """
    Valida refresh token, lo rota y devuelve nuevo par
    """
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

    with db_connection() as conn:
        with conn.cursor() as cur:

            # 1️⃣ Buscar token válido
            cur.execute("""
                SELECT id, user_id, expires_at, revoked
                FROM refresh_tokens
                WHERE token_hash = %s
            """, (token_hash,))

            row = cur.fetchone()

            if not row:
                return None

            token_id, user_id, expires_at, revoked = row

            if revoked:
                # 🚨 Detectar reuse attack
                cur.execute("""
                    SELECT replaced_by
                    FROM refresh_tokens
                    WHERE id = %s
                """, (token_id,))

                replaced = cur.fetchone()[0]

                if replaced:
                    # 🔥 Revocar TODAS las sesiones activas del usuario
                    cur.execute("""
                        UPDATE refresh_tokens
                        SET revoked = TRUE,
                            revoked_at = NOW()
                        WHERE user_id = %s
                        AND revoked = FALSE
                    """, (user_id,))

                    conn.commit()

                    return None

            if expires_at < datetime.utcnow():
                return None

            # 2️⃣ Generar nuevo refresh
            new_refresh = create_refresh_token()
            new_hash = hashlib.sha256(new_refresh.encode()).hexdigest()
            new_expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)

            # 3️⃣ Insertar nuevo token primero
            cur.execute("""
                INSERT INTO refresh_tokens (
                    user_id,
                    token_hash,
                    expires_at
                )
                 VALUES (%s, %s, %s)
                RETURNING id
            """, (user_id, new_hash, new_expires))

            new_token_id = cur.fetchone()[0]

            # 4️⃣ Marcar anterior como revocado Y enlazar replaced_by
            cur.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE,
                    revoked_at = NOW(),
                    replaced_by = %s
                WHERE id = %s
            """, (new_token_id, token_id))

        conn.commit()

    blocks = get_user_blocks(str(user_id))
    return user_id, new_refresh, blocks

def revoke_refresh_token(refresh_token: str) -> bool:
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE refresh_tokens
                SET revoked = TRUE,
                    revoked_at = NOW()
                WHERE token_hash = %s
                  AND revoked = FALSE
                RETURNING id
            """, (token_hash,))

            row = cur.fetchone()

        conn.commit()

    return bool(row)

def cleanup_expired_refresh_tokens():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                DELETE FROM refresh_tokens
                WHERE expires_at < NOW()
            """)
        conn.commit()
