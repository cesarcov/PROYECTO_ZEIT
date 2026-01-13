import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager

@contextmanager
def db_connection():
    conn = psycopg2.connect(
        host="localhost",
        port=5432,
        database="erp_logistica",
        user="postgres",
        password="postgres"
    )
    try:
        yield conn
    finally:
        conn.close()
