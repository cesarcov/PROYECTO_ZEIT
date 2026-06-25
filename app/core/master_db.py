import psycopg2
from contextlib import contextmanager
from app.core.config import settings
from app.core.database import _parse_db_url


@contextmanager
def master_db_connection():
    url = settings.MASTER_DATABASE_URL or settings.DATABASE_URL
    _db = _parse_db_url(url)
    conn = psycopg2.connect(**_db)
    try:
        yield conn
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
