"""Conexión a la master DB (registro de tenants).

F-000 / T-08 — antes abría una conexión nueva con `psycopg2.connect()` en cada
llamada y la cerraba al terminar. Como el TenantMiddleware la usa en TODA
petición que trae cabecera `X-Tenant-ID`, eso suponía un handshake TCP por
petición. Ahora se sirve del mismo pool que el resto de la aplicación.
"""
from app.core.db import get_master_conn


def master_db_connection():
    """Context manager de conexión a la master DB, servida por el pool."""
    return get_master_conn()
