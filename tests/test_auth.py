"""F-000 / T-09 — primeros tests del ciclo de autenticación.

Cubre: login, refresh, logout y el flujo 401 → refresh → reintento.

Las credenciales vienen del entorno vía `tests/conftest.py`; sin ellas los
tests se omiten (F-000 / T-01).
"""
import pytest
from jose import jwt

from app.core.config import settings

pytestmark = pytest.mark.db


@pytest.fixture
def credenciales(user_creds):
    if not user_creds:
        pytest.skip("TEST_USER / TEST_PASSWORD no configurados en el entorno")
    return user_creds


@pytest.fixture
def sesion(client, credenciales):
    """Un login limpio por test: devuelve el cuerpo completo de la respuesta."""
    username, password = credenciales
    r = client.post("/auth/login", data={"username": username, "password": password})
    assert r.status_code == 200, r.text[:300]
    return r.json()


# ── Login ────────────────────────────────────────────────────────────────────


def test_login_devuelve_par_de_tokens(sesion):
    assert sesion["token_type"] == "bearer"
    assert sesion["access_token"], "falta el access_token"
    assert sesion["refresh_token"], "falta el refresh_token"


def test_el_access_token_lleva_permisos_y_expiracion(sesion):
    payload = jwt.decode(
        sesion["access_token"], settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
    )
    assert payload["sub"], "el token debe identificar al usuario"
    assert isinstance(payload["permissions"], list)
    assert payload["exp"] > payload["iat"], "el token debe tener expiración futura"


def test_login_con_password_incorrecta_es_401(client, credenciales):
    username, _ = credenciales
    r = client.post("/auth/login", data={"username": username, "password": "no-es-la-buena"})
    assert r.status_code == 401
    # El mensaje NO debe revelar si el usuario existe (evita enumeración).
    assert "no existe" not in r.text.lower()


def test_login_con_usuario_inexistente_es_401_con_el_mismo_mensaje(client, credenciales):
    """Usuario inexistente y contraseña mala deben ser indistinguibles."""
    username, _ = credenciales
    r_malo = client.post("/auth/login", data={"username": username, "password": "mala"})
    r_inexistente = client.post(
        "/auth/login", data={"username": "usuario_que_no_existe_jamas", "password": "mala"}
    )
    assert r_malo.status_code == r_inexistente.status_code == 401
    assert r_malo.json()["error"]["message"] == r_inexistente.json()["error"]["message"]


# ── /auth/me ─────────────────────────────────────────────────────────────────


def test_me_devuelve_el_usuario_autenticado(client, sesion, credenciales):
    username, _ = credenciales
    cabecera = {"Authorization": f"Bearer {sesion['access_token']}"}
    r = client.get("/auth/me", headers=cabecera)
    assert r.status_code == 200, r.text[:300]
    assert r.json()["username"] == username


def test_me_sin_token_es_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_con_token_invalido_es_401(client):
    r = client.get("/auth/me", headers={"Authorization": "Bearer esto.no.es.un.jwt"})
    assert r.status_code == 401


def test_me_con_token_firmado_con_otra_clave_es_401(client):
    """Un atacante que forje un token con otra clave no entra."""
    falso = jwt.encode(
        {"sub": "00000000-0000-0000-0000-000000000000", "permissions": ["admin:all"]},
        "clave-del-atacante-que-no-es-la-del-servidor",
        algorithm="HS256",
    )
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {falso}"})
    assert r.status_code == 401


# ── Refresh ──────────────────────────────────────────────────────────────────


def test_refresh_devuelve_tokens_nuevos(client, sesion):
    r = client.post("/auth/refresh", json={"refresh_token": sesion["refresh_token"]})
    assert r.status_code == 200, r.text[:300]
    nuevo = r.json()
    assert nuevo["access_token"]
    assert nuevo["refresh_token"] != sesion["refresh_token"], "el refresh debe rotar"


def test_el_refresh_token_usado_queda_invalidado(client, sesion):
    """Rotación: el token viejo no vale una segunda vez."""
    viejo = sesion["refresh_token"]
    primera = client.post("/auth/refresh", json={"refresh_token": viejo})
    assert primera.status_code == 200

    segunda = client.post("/auth/refresh", json={"refresh_token": viejo})
    assert segunda.status_code == 401, "reusar un refresh token debe ser rechazado"


def test_refresh_con_token_basura_es_401(client):
    r = client.post("/auth/refresh", json={"refresh_token": "token-inventado"})
    assert r.status_code == 401


def test_el_access_token_del_refresh_sirve_para_llamar_al_api(client, sesion):
    nuevo = client.post("/auth/refresh", json={"refresh_token": sesion["refresh_token"]}).json()
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {nuevo['access_token']}"})
    assert r.status_code == 200, r.text[:300]


# ── Logout ───────────────────────────────────────────────────────────────────


def test_logout_revoca_el_refresh_token(client, sesion):
    r = client.post("/auth/logout", json={"refresh_token": sesion["refresh_token"]})
    assert r.status_code == 200, r.text[:300]

    reintento = client.post("/auth/refresh", json={"refresh_token": sesion["refresh_token"]})
    assert reintento.status_code == 401, "tras logout el refresh token no debe servir"


def test_logout_dos_veces_es_rechazado(client, sesion):
    assert client.post("/auth/logout", json={"refresh_token": sesion["refresh_token"]}).status_code == 200
    segunda = client.post("/auth/logout", json={"refresh_token": sesion["refresh_token"]})
    assert segunda.status_code == 400


# ── Flujo completo 401 → refresh → reintento ─────────────────────────────────


def test_flujo_401_refresh_reintento(client, sesion):
    """El camino que recorre el frontend cuando le caduca el access token."""
    # 1. Una llamada con un access token inválido devuelve 401.
    caducado = {"Authorization": "Bearer token.claramente.invalido"}
    assert client.get("/auth/me", headers=caducado).status_code == 401

    # 2. El cliente usa su refresh token para conseguir uno nuevo.
    r = client.post("/auth/refresh", json={"refresh_token": sesion["refresh_token"]})
    assert r.status_code == 200, r.text[:300]
    nuevo_access = r.json()["access_token"]

    # 3. Reintenta la llamada original y ahora sí funciona.
    reintento = client.get("/auth/me", headers={"Authorization": f"Bearer {nuevo_access}"})
    assert reintento.status_code == 200, reintento.text[:300]
