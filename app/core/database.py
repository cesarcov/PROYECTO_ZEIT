import psycopg2
from psycopg2.pool import ThreadedConnectionPool
import threading
from contextlib import contextmanager
from urllib.parse import urlparse
from app.core.config import settings

# Diccionario global para cachear los pools de conexiones por base de datos
_pools = {}
_pools_lock = threading.Lock()

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

def get_connection_pool(db_config: dict) -> ThreadedConnectionPool:
    """
    Retorna o inicializa un pool de conexiones hilo-seguro para la configuración dada.
    """
    pool_key = (db_config.get("host"), db_config.get("port"), db_config.get("database"), db_config.get("user"))
    with _pools_lock:
        if pool_key not in _pools:
            # Tamaño del pool configurable (por defecto Min=1, Max=5 para prevenir saturación en multi-tenant)
            minconn = settings.DB_POOL_MIN
            maxconn = settings.DB_POOL_MAX
            _pools[pool_key] = ThreadedConnectionPool(minconn, maxconn, **db_config)
    return _pools[pool_key]

@contextmanager
def db_connection():
    from app.core.tenant_context import get_tenant_db
    tenant_url = get_tenant_db()
    _db = _parse_db_url(tenant_url if tenant_url else settings.DATABASE_URL)
    
    try:
        pool = get_connection_pool(_db)
        conn = pool.getconn()
    except UnicodeDecodeError:
        # On Spanish Windows, PostgreSQL returns error messages in Windows-1252
        # (e.g. "autenticación" with byte 0xf3). psycopg2 tries to decode them
        # as UTF-8 and crashes before raising the proper OperationalError.
        # This almost always means the password in DATABASE_URL is wrong.
        raise psycopg2.OperationalError(
            "Error de autenticación o conexión con PostgreSQL. "
            "Verifica que la contraseña en DATABASE_URL del .env sea correcta."
        )
    except Exception as e:
        raise psycopg2.OperationalError(
            f"Error al conectar con la base de datos o al obtener conexión del pool: {e}"
        )
        
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        try:
            pool.putconn(conn)
        except Exception:
            pass

