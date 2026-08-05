"""F-000 / T-05 — el health check refleja el estado REAL del servicio.

Criterios de aceptación que cubre:
  · /health devuelve 503 si la base de datos cae
  · /health expone pool_in_use y la versión desplegada
"""
import psycopg2
import pytest
from fastapi.testclient import TestClient

import app.main as main_module
from app.main import app


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_ok_con_bd_arriba(client):
    r = client.get("/health")
    assert r.status_code == 200, r.text[:300]
    cuerpo = r.json()
    assert cuerpo["status"] == "ok"
    assert cuerpo["db"] == "ok"


def test_health_expone_estado_del_pool_y_version(client):
    cuerpo = client.get("/health").json()
    assert "pool" in cuerpo, "el health check debe exponer el estado del pool"
    for clave in ("pools", "in_use", "idle", "max_per_pool"):
        assert clave in cuerpo["pool"], f"falta '{clave}' en el estado del pool"
    assert isinstance(cuerpo["pool"]["in_use"], int)
    assert cuerpo.get("version"), "el health check debe declarar la versión desplegada"
    assert cuerpo.get("env") in ("development", "staging", "production")


def test_health_devuelve_503_si_la_bd_cae(client, monkeypatch):
    """Con la BD caída el monitor externo debe ver un fallo, no un 200 mentiroso."""

    def bd_caida():
        raise psycopg2.OperationalError("conexión rechazada (simulado)")

    monkeypatch.setattr(main_module, "db_connection", bd_caida)

    r = client.get("/health")
    assert r.status_code == 503, f"se esperaba 503 con la BD caída, llegó {r.status_code}"
    cuerpo = r.json()
    assert cuerpo["status"] == "unhealthy"
    assert cuerpo["db"] == "error"
    # El error se reporta por TIPO, nunca con la cadena de conexión ni credenciales.
    assert cuerpo.get("db_error") == "OperationalError"
    assert "password" not in r.text.lower()


def test_health_vuelve_a_ok_tras_restaurar_la_bd(client):
    """El monkeypatch del test anterior no debe dejar el servicio marcado como caído."""
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"
