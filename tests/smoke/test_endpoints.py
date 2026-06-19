"""Smoke tests — la app arranca y los endpoints críticos responden 200 con la forma esperada.

Corren EN PROCESO con TestClient de FastAPI (no necesitan levantar uvicorn).
Requisito: PostgreSQL local arriba (DB erp_logistica) y el usuario demo juliet_alvis.

Estos tests son la compuerta antirregresión: si un cambio rompe un endpoint crítico,
se ven en rojo en segundos en vez de descubrirse en producción.
"""
import pytest
from fastapi.testclient import TestClient

from app.main import app

USER = "juliet_alvis"
PWD = "123456"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def auth(client):
    r = client.post("/auth/login", data={"username": USER, "password": PWD})
    assert r.status_code == 200, f"login falló: {r.status_code} {r.text[:200]}"
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_app_importa():
    # Llegar aquí ya prueba que `from app.main import app` no rompe.
    assert app is not None


def test_login_funciona(auth):
    assert auth["Authorization"].startswith("Bearer ")


def test_reporting_dashboard_kpis(client, auth):
    """Regresión cubierta: los 3 bugs 500 de 2026-06-11 (float(None), oci.cantidad, dispatches)."""
    r = client.get("/reporting/requests/kpis/dashboard-kpis", headers=auth)
    assert r.status_code == 200, r.text[:300]
    data = r.json()
    for area in ("logistics", "operations", "compras", "admin", "weak_points"):
        assert area in data, f"falta el área '{area}' en el dashboard de KPIs"


def test_audit_logs(client, auth):
    r = client.get("/admin/audit-logs?limit=10", headers=auth)
    assert r.status_code == 200, r.text[:300]
    assert isinstance(r.json(), list)


def test_planificacion_actividades(client, auth):
    r = client.get("/planificacion/actividades", headers=auth)
    assert r.status_code == 200, r.text[:300]
    assert isinstance(r.json(), list)
