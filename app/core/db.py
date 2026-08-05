"""Acceso a la base de datos — punto ÚNICO de entrada al pool de conexiones.

F-000 / T-08 — nadie debe llamar a `pool.getconn()` / `pool.putconn()` ni a
`psycopg2.connect()` a mano. Toda la aplicación pide conexiones aquí:

    from app.core.db import get_conn

    # Sólo lectura
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT ...")

    # Escritura: el commit lo hace el context manager al salir sin error
    with get_conn(commit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE ...")

Garantías (por eso existe este módulo):

1. La conexión SIEMPRE vuelve al pool, incluso si el bloque lanza una
   excepción. Es lo que previene la fuga de conexiones.
2. Si el bloque falla, se hace `rollback()`: nunca queda media escritura.
3. Antes de devolverla al pool se limpia cualquier transacción abierta que el
   llamador dejara sin cerrar. Sin esto, el siguiente que tomara esa conexión
   heredaría una transacción sucia ajena.
"""
import logging
import threading
from contextlib import contextmanager
from urllib.parse import urlparse

import psycopg2
from psycopg2.pool import ThreadedConnectionPool

from app.core.config import settings

logger = logging.getLogger(__name__)

# Un pool por base de datos (multi-tenant): {clave_bd: pool}
_pools: dict[tuple, ThreadedConnectionPool] = {}
_pools_lock = threading.Lock()


def parse_db_url(url: str) -> dict:
    """Descompone una URL de conexión, tolerando esquemas con driver."""
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
    """Pool hilo-seguro para la configuración dada; se crea la primera vez."""
    pool_key = (
        db_config.get("host"),
        db_config.get("port"),
        db_config.get("database"),
        db_config.get("user"),
    )
    with _pools_lock:
        if pool_key not in _pools:
            _pools[pool_key] = ThreadedConnectionPool(
                settings.DB_POOL_MIN, settings.DB_POOL_MAX, **db_config
            )
    return _pools[pool_key]


def pool_stats() -> dict:
    """Estado agregado de los pools abiertos — lo consume /health (F-000 / T-05).

    `in_use` son las conexiones prestadas ahora mismo; si se acerca a `max` de
    forma sostenida, hay fuga de conexiones o el pool se quedó corto.
    """
    with _pools_lock:
        pools = list(_pools.values())

    in_use = 0
    idle = 0
    for pool in pools:
        # psycopg2 no expone una API pública para esto; se leen los atributos
        # internos de forma defensiva para no tumbar nunca el health check.
        try:
            in_use += len(getattr(pool, "_used", {}))
            idle += len(getattr(pool, "_pool", []))
        except Exception:
            continue

    return {
        "pools": len(pools),
        "in_use": in_use,
        "idle": idle,
        "max_per_pool": settings.DB_POOL_MAX,
    }


def _resolver_url() -> str:
    """URL de la BD del tenant activo, o la de por defecto si no hay tenant."""
    from app.core.tenant_context import get_tenant_db

    return get_tenant_db() or settings.DATABASE_URL


@contextmanager
def get_conn(commit: bool = False):
    """Presta una conexión del pool y garantiza su devolución.

    `commit=True` confirma la transacción al salir del bloque sin excepción.
    Con `commit=False` (por defecto) el bloque es de sólo lectura: si el
    llamador escribió sin confirmar, el cambio se descarta al cerrar.
    """
    db_config = parse_db_url(_resolver_url())

    try:
        pool = get_connection_pool(db_config)
        conn = pool.getconn()
    except UnicodeDecodeError:
        # En Windows en español, PostgreSQL devuelve los mensajes de error en
        # Windows-1252 (p. ej. "autenticación" con el byte 0xf3). psycopg2
        # intenta decodificarlos como UTF-8 y revienta antes de lanzar el
        # OperationalError real. Casi siempre significa contraseña incorrecta.
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
        if commit:
            conn.commit()
    except Exception:
        _rollback_silencioso(conn)
        raise
    finally:
        # Limpiar cualquier transacción que el llamador dejara abierta ANTES de
        # devolver la conexión: si no, el siguiente que la tome hereda estado
        # ajeno (locks incluidos).
        _limpiar(conn)
        try:
            pool.putconn(conn)
        except Exception:
            logger.warning("No se pudo devolver la conexión al pool", exc_info=True)


def _rollback_silencioso(conn) -> None:
    try:
        conn.rollback()
    except Exception:
        logger.debug("Rollback fallido (la conexión probablemente ya está rota)", exc_info=True)


def _limpiar(conn) -> None:
    """Deja la conexión sin transacción abierta antes de devolverla al pool."""
    try:
        # INTRANS / INERROR = hay una transacción viva que nadie cerró.
        if conn.get_transaction_status() != psycopg2.extensions.TRANSACTION_STATUS_IDLE:
            conn.rollback()
    except Exception:
        logger.debug("No se pudo limpiar el estado de la conexión", exc_info=True)


@contextmanager
def get_master_conn():
    """Conexión a la master DB (registro de tenants), también desde el pool."""
    db_config = parse_db_url(settings.MASTER_DATABASE_URL or settings.DATABASE_URL)
    pool = get_connection_pool(db_config)
    conn = pool.getconn()
    try:
        yield conn
    except Exception:
        _rollback_silencioso(conn)
        raise
    finally:
        _limpiar(conn)
        try:
            pool.putconn(conn)
        except Exception:
            logger.warning("No se pudo devolver la conexión master al pool", exc_info=True)


def cerrar_todos_los_pools() -> None:
    """Cierra todos los pools. Se usa al apagar el servicio y en los tests."""
    with _pools_lock:
        for pool in _pools.values():
            try:
                pool.closeall()
            except Exception:
                logger.debug("Fallo cerrando un pool", exc_info=True)
        _pools.clear()
