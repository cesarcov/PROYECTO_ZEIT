"""Smoke tests para la feature 008-control-acceso-bloques.

Patrón: save → test → restore para no dejar datos de test en producción.
Requiere que SUPERADMIN_USERNAME y SUPERADMIN_PASSWORD_HASH estén en .env.
Si las credenciales del superadmin no están configuradas, los tests se omiten.
"""
import pytest
import os
from fastapi.testclient import TestClient
from app.main import app

SUPERADMIN_USER = os.getenv("SUPERADMIN_USERNAME", "")
SUPERADMIN_PASS = os.getenv("SUPERADMIN_PLAIN_PASSWORD", "")

REGULAR_USER = "juliet_alvis"
REGULAR_PASS = "123456"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="module")
def superadmin_token(client):
    if not SUPERADMIN_USER or not SUPERADMIN_PASS:
        pytest.skip("SUPERADMIN_USERNAME / SUPERADMIN_PLAIN_PASSWORD no configurados en .env")
    r = client.post("/auth/login", data={"username": SUPERADMIN_USER, "password": SUPERADMIN_PASS})
    assert r.status_code == 200, f"login superadmin falló: {r.text[:200]}"
    data = r.json()
    assert data.get("blocks") == "all", "superadmin debe recibir blocks='all'"
    return {"Authorization": f"Bearer {data['access_token']}"}


@pytest.fixture(scope="module")
def regular_user_id(client, superadmin_token):
    r = client.get("/superadmin/users", headers=superadmin_token)
    assert r.status_code == 200
    users = r.json()
    for u in users:
        if u["username"] == REGULAR_USER:
            return u["id"]
    pytest.skip(f"Usuario {REGULAR_USER} no encontrado en /superadmin/users")


def test_login_returns_blocks(client):
    r = client.post("/auth/login", data={"username": REGULAR_USER, "password": REGULAR_PASS})
    assert r.status_code == 200
    data = r.json()
    assert "blocks" in data, "La respuesta de login debe incluir el campo 'blocks'"
    assert isinstance(data["blocks"], list), "blocks debe ser lista para usuario normal"


def test_superadmin_list_users(client, superadmin_token):
    r = client.get("/superadmin/users", headers=superadmin_token)
    assert r.status_code == 200
    users = r.json()
    assert isinstance(users, list)
    for u in users:
        assert "blocks" in u, f"Usuario {u.get('username')} no tiene campo 'blocks'"


def test_set_and_restore_blocks(client, superadmin_token, regular_user_id):
    uid = regular_user_id

    # Guardar estado inicial
    r = client.get(f"/superadmin/users/{uid}/blocks", headers=superadmin_token)
    assert r.status_code == 200
    original = r.json()
    original_blocks = [
        {"slug": b["slug"], "level": b["level"]}
        for b in original["blocks"] if b["level"] is not None
    ]

    # Asignar bloques de prueba
    test_blocks = [{"slug": "logistica", "level": "view"}]
    r = client.put(
        f"/superadmin/users/{uid}/blocks",
        headers=superadmin_token,
        json={"blocks": test_blocks},
    )
    assert r.status_code == 200, f"PUT falló: {r.text[:200]}"
    result = r.json()
    slugs_assigned = [b["slug"] for b in result["blocks"] if b["level"] is not None]
    assert "logistica" in slugs_assigned

    # Restaurar estado original
    r = client.put(
        f"/superadmin/users/{uid}/blocks",
        headers=superadmin_token,
        json={"blocks": original_blocks},
    )
    assert r.status_code == 200, "Restauración de bloques falló"


def test_invalid_slug_returns_422(client, superadmin_token, regular_user_id):
    r = client.put(
        f"/superadmin/users/{regular_user_id}/blocks",
        headers=superadmin_token,
        json={"blocks": [{"slug": "inexistente", "level": "edit"}]},
    )
    assert r.status_code == 422, f"Slug inválido debería retornar 422, got {r.status_code}"


def test_auth_me_returns_blocks(client):
    r = client.post("/auth/login", data={"username": REGULAR_USER, "password": REGULAR_PASS})
    token = r.json()["access_token"]
    r2 = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r2.status_code == 200
    assert "blocks" in r2.json(), "/auth/me debe incluir el campo 'blocks'"
