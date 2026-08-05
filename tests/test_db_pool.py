"""F-000 / T-08 — el context manager único no deja fugar conexiones.

Criterio de aceptación: "test que fuerza una excepción y verifica que la
conexión vuelve al pool".

Estos tests necesitan una base de datos real (marca `db`).
"""
import psycopg2
import pytest

from app.core.db import get_conn, pool_stats

pytestmark = pytest.mark.db


class ErrorDePrueba(RuntimeError):
    """Excepción sintética para forzar el camino de error."""


def _en_uso() -> int:
    return pool_stats()["in_use"]


def test_la_conexion_vuelve_al_pool_en_el_camino_feliz():
    antes = _en_uso()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone()[0] == 1
        assert _en_uso() == antes + 1, "durante el bloque la conexión debe estar prestada"
    assert _en_uso() == antes, "la conexión no volvió al pool"


def test_la_conexion_vuelve_al_pool_si_el_bloque_lanza_excepcion():
    """Es EL caso que causa fuga de conexiones si el finally no está bien puesto."""
    antes = _en_uso()

    with pytest.raises(ErrorDePrueba):
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
            raise ErrorDePrueba("fallo simulado a mitad de la operación")

    assert _en_uso() == antes, "la conexión se fugó tras la excepción"


def test_la_conexion_vuelve_al_pool_si_falla_el_sql():
    """Un error de PostgreSQL deja la conexión en estado INERROR: hay que limpiarla."""
    antes = _en_uso()

    with pytest.raises(psycopg2.Error):
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM tabla_que_no_existe_jamas")

    assert _en_uso() == antes, "la conexión se fugó tras el error de SQL"

    # Y la conexión reciclada debe estar limpia: si heredara la transacción
    # abortada, este SELECT fallaría con "current transaction is aborted".
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            assert cur.fetchone()[0] == 1


def test_una_transaccion_huerfana_no_contamina_al_siguiente():
    """Si alguien escribe y no confirma, el siguiente usuario no debe heredarlo."""
    antes = _en_uso()

    # Bloque de sólo lectura que escribe sin confirmar: al salir se descarta.
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE TEMP TABLE prueba_huerfana (id int)")
            cur.execute("INSERT INTO prueba_huerfana VALUES (1)")

    assert _en_uso() == antes

    # La conexión reciclada debe estar IDLE, sin transacción abierta heredada.
    with get_conn() as conn:
        estado = conn.get_transaction_status()
        assert estado == psycopg2.extensions.TRANSACTION_STATUS_IDLE, (
            f"la conexión volvió al pool con una transacción abierta (estado={estado})"
        )


def test_commit_true_confirma_y_sin_commit_descarta():
    """`get_conn(commit=True)` confirma; el modo por defecto no."""
    with get_conn(commit=True) as conn:
        with conn.cursor() as cur:
            cur.execute("CREATE TABLE IF NOT EXISTS prueba_commit_t08 (id int PRIMARY KEY)")
            cur.execute("DELETE FROM prueba_commit_t08")

    try:
        # Sin commit: el INSERT se descarta al salir del bloque.
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO prueba_commit_t08 VALUES (1)")

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM prueba_commit_t08")
                assert cur.fetchone()[0] == 0, "sin commit no debería haberse guardado nada"

        # Con commit: persiste.
        with get_conn(commit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("INSERT INTO prueba_commit_t08 VALUES (2)")

        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT count(*) FROM prueba_commit_t08")
                assert cur.fetchone()[0] == 1, "con commit=True el dato debe persistir"
    finally:
        with get_conn(commit=True) as conn:
            with conn.cursor() as cur:
                cur.execute("DROP TABLE IF EXISTS prueba_commit_t08")


def test_muchas_operaciones_seguidas_no_agotan_el_pool():
    """Regresión: una fuga de una conexión por llamada agota el pool en N iteraciones."""
    antes = _en_uso()
    for i in range(30):
        try:
            with get_conn() as conn:
                with conn.cursor() as cur:
                    # Alterna éxito y error para ejercitar ambos caminos.
                    cur.execute("SELECT 1" if i % 2 == 0 else "SELECT no_existe")
        except psycopg2.Error:
            pass
    assert _en_uso() == antes, "el pool perdió conexiones tras 30 operaciones"
