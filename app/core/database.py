import psycopg2
from contextlib import contextmanager
from urllib.parse import urlparse
from app.core.config import settings

def _parse_db_url(url: str) -> dict:
    # Normalizar esquemas con driver (postgresql+asyncpg://, etc.)
    normalized = url.split("://", 1)
    scheme = normalized[0].split("+")[0]
    parsed = urlparse(f"{scheme}://{normalized[1]}")
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path.lstrip("/"),
        "user": parsed.username,
        "password": parsed.password,
    }

@contextmanager
def db_connection():
    _db = _parse_db_url(settings.DATABASE_URL)
    try:
        conn = psycopg2.connect(**_db)
    except UnicodeDecodeError:
        # On Spanish Windows, PostgreSQL returns error messages in Windows-1252
        # (e.g. "autenticación" with byte 0xf3). psycopg2 tries to decode them
        # as UTF-8 and crashes before raising the proper OperationalError.
        # This almost always means the password in DATABASE_URL is wrong.
        raise psycopg2.OperationalError(
            "Error de autenticación o conexión con PostgreSQL. "
            "Verifica que la contraseña en DATABASE_URL del .env sea correcta."
        )
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
