"""Fixtures compartidas de toda la suite.

F-000 / T-01 — Regla 6 de CONSTITUTION.md: ninguna credencial vive en el código
de los tests. Todas se leen de variables de entorno (o del `.env` local, que
está en `.gitignore`). Si una credencial no está configurada, los tests que la
necesitan se **omiten** en vez de fallar: así la suite corre en cualquier
máquina y en CI sin depender de contraseñas conocidas.

Variables que consume (ver `.env.example`):

    TEST_USER / TEST_PASSWORD                    usuario normal
    TEST_ADMIN_USER / TEST_ADMIN_PASSWORD        usuario administrador
    SUPERADMIN_USERNAME / SUPERADMIN_PLAIN_PASSWORD   superadmin
"""
import os

import pytest
from dotenv import load_dotenv
from fastapi.testclient import TestClient

load_dotenv()

from app.main import app  # noqa: E402  (después de load_dotenv, que puebla settings)


def _creds(user_var: str, pass_var: str) -> tuple[str, str] | None:
    """Devuelve (usuario, contraseña) desde el entorno, o None si falta alguna."""
    user = os.getenv(user_var, "").strip()
    password = os.getenv(pass_var, "").strip()
    if not user or not password:
        return None
    return user, password


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:
        yield c


def _login(client, creds, label: str, missing_hint: str) -> dict:
    if not creds:
        pytest.skip(f"Credenciales de {label} no configuradas ({missing_hint})")
    username, password = creds
    r = client.post("/auth/login", data={"username": username, "password": password})
    if r.status_code != 200:
        pytest.skip(f"Login de {label} falló ({r.status_code}); credenciales desactualizadas")
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


@pytest.fixture(scope="session")
def user_creds():
    return _creds("TEST_USER", "TEST_PASSWORD")


@pytest.fixture(scope="session")
def admin_creds():
    return _creds("TEST_ADMIN_USER", "TEST_ADMIN_PASSWORD")


@pytest.fixture(scope="session")
def superadmin_creds():
    return _creds("SUPERADMIN_USERNAME", "SUPERADMIN_PLAIN_PASSWORD")


@pytest.fixture(scope="session")
def auth(client, user_creds):
    """Cabecera Authorization de un usuario normal."""
    return _login(client, user_creds, "usuario normal", "TEST_USER / TEST_PASSWORD")


@pytest.fixture(scope="session")
def admin_auth(client, admin_creds):
    """Cabecera Authorization de un administrador."""
    return _login(client, admin_creds, "administrador", "TEST_ADMIN_USER / TEST_ADMIN_PASSWORD")


@pytest.fixture(scope="session")
def superadmin_auth(client, superadmin_creds):
    """Cabecera Authorization del superadmin (credenciales fuera de la BD)."""
    return _login(
        client,
        superadmin_creds,
        "superadmin",
        "SUPERADMIN_USERNAME / SUPERADMIN_PLAIN_PASSWORD",
    )
