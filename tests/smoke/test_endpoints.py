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


# ── Export de Planificación con filtro por responsable (feature 001) ──────────

def _assert_xlsx(r):
    assert r.status_code == 200, r.text[:300]
    # Un .xlsx es un ZIP: siempre empieza con la firma "PK".
    assert r.content[:2] == b"PK", f"no parece un xlsx: {r.content[:16]!r}"


def test_export_planificacion_base(client, auth):
    """Sin filtro de responsable → export funciona igual que siempre (FR-004)."""
    r = client.get("/planificacion/actividades/export", headers=auth)
    _assert_xlsx(r)


def test_export_planificacion_por_responsable(client, auth):
    """Filtrar por una persona devuelve un xlsx válido (US1/US2, FR-002/FR-005)."""
    acts = client.get("/planificacion/actividades", headers=auth).json()
    rid = None
    for a in acts:
        rid = (a.get("responsables_ids") or "").split(",")[0].strip() or a.get("responsable_id")
        if rid:
            break
    rid = rid or "00000000-0000-0000-0000-000000000000"
    r = client.get(f"/planificacion/actividades/export?responsable={rid}", headers=auth)
    _assert_xlsx(r)


def test_export_planificacion_sin_responsable(client, auth):
    """Opción 'sin responsable asignado' (US3, FR-007)."""
    r = client.get("/planificacion/actividades/export?responsable=__none__", headers=auth)
    _assert_xlsx(r)
