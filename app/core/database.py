"""Compatibilidad — el acceso real a la base de datos vive en `app/core/db.py`.

F-000 / T-08 — este módulo se mantiene porque hay ~340 llamadas repartidas en
31 módulos que importan `db_connection` desde aquí. Todas delegan ya en el
context manager único, así que heredan sus garantías (devolución al pool,
rollback ante error, limpieza de transacciones huérfanas).

CÓDIGO NUEVO: importa desde `app.core.db`, no desde aquí.

    from app.core.db import get_conn

    with get_conn(commit=True) as conn:   # escritura
        ...
"""
from app.core.db import (  # noqa: F401  (re-export deliberado)
    cerrar_todos_los_pools,
    get_conn,
    get_connection_pool,
    parse_db_url,
    pool_stats,
)

# Alias histórico: `_parse_db_url` con guion bajo lo importa app/core/master_db.py.
_parse_db_url = parse_db_url


def db_connection():
    """Alias histórico de `get_conn()` (sólo lectura; el commit es explícito).

    Se conserva por los llamadores existentes. En código nuevo usa
    `get_conn(commit=True)` para escrituras en vez de llamar a `conn.commit()`
    a mano.
    """
    return get_conn(commit=False)
