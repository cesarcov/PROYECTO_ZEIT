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


# ── Preferencias de usuario / tema (feature 002) ──────────────────────────────

def test_user_preferences_persiste(client, auth):
    """PUT guarda el tema en la cuenta y GET lo devuelve (US2, FR-003)."""
    r = client.put("/auth/me/preferences", headers=auth, json={"tema": "zeit-oscuro"})
    assert r.status_code == 200, r.text[:300]
    assert r.json().get("tema") == "zeit-oscuro"
    r2 = client.get("/auth/me/preferences", headers=auth)
    assert r2.status_code == 200, r2.text[:300]
    assert r2.json().get("tema") == "zeit-oscuro"


def test_user_preferences_rechaza_tema_invalido(client, auth):
    """Un tema fuera del catálogo se rechaza (validación defensiva)."""
    r = client.put("/auth/me/preferences", headers=auth, json={"tema": "no-existe"})
    assert r.status_code == 422, r.text[:300]


# ── Marca configurable / white-label (feature 003) ────────────────────────────

@pytest.fixture(scope="module")
def admin_auth(client):
    r = client.post("/auth/login", data={"username": "admin", "password": "admin123"})
    if r.status_code != 200:
        pytest.skip("usuario admin (admin/admin123) no disponible")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def test_branding_publico(client):
    """GET /branding es público (lo usa el login) y trae la marca + crédito."""
    r = client.get("/branding")
    assert r.status_code == 200, r.text[:300]
    d = r.json()
    assert d.get("appName") and d.get("poweredBy")


def test_branding_requiere_admin_para_escribir(client):
    """PUT /branding sin token es rechazado (US4, FR-001)."""
    r = client.put("/branding", json={"nombre_producto": "X"})
    assert r.status_code in (401, 403), r.text[:200]


def test_branding_update_validacion_y_reset(client, admin_auth):
    """Admin actualiza nombre (200), color inválido → 422, y restablece a ZEIT.

    NOTA: este test restaura los campos de texto al terminar para no borrar la
    configuración real del servidor. Los archivos de logo NO se pueden restaurar
    automáticamente — el DELETE solo se ejecuta si no hay logos subidos.
    """
    # Guardar estado actual para restaurarlo al final (evitar destruir config real).
    prev = client.get("/branding").json()
    prev_colors = prev.get("colors") or {}
    prev_logos = prev.get("logos") or {}
    tiene_logos = any(v for v in prev_logos.values())

    # Verificar que PUT actualiza el nombre.
    r = client.put("/branding", headers=admin_auth, json={"nombre_producto": "ACME TEST"})
    assert r.status_code == 200, r.text[:300]
    assert r.json().get("appName") == "ACME TEST"

    # Verificar que un color inválido devuelve 422.
    r2 = client.put("/branding", headers=admin_auth, json={"color_primario": "noesuncolor"})
    assert r2.status_code == 422, r2.text[:200]

    if not tiene_logos:
        # Solo llama DELETE si no había logos reales: evita borrar archivos del servidor.
        r3 = client.delete("/branding", headers=admin_auth)
        assert r3.status_code == 200, r3.text[:300]
        assert r3.json().get("appName") == "ZEIT SOLUTIONS"
    else:
        # Con logos configurados: restaurar solo los campos de texto/colores.
        restore: dict = {}
        prev_name = prev.get("appName", "")
        if prev_name and prev_name != "ZEIT SOLUTIONS":
            restore["nombre_producto"] = prev_name
        if prev.get("tagline"):
            restore["eslogan"] = prev["tagline"]
        if prev_colors.get("primary"):
            restore["color_primario"] = prev_colors["primary"]
        if prev_colors.get("accent"):
            restore["color_acento"] = prev_colors["accent"]
        if prev_colors.get("action"):
            restore["color_accion"] = prev_colors["action"]
        if restore:
            client.put("/branding", headers=admin_auth, json=restore)
