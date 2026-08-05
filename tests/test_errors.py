"""F-000 / T-03 — sobre único de errores y request-id.

Criterios de aceptación que cubre:
  · un error de negocio devuelve {error:{code,message,request_id}}
  · un error NO manejado nunca filtra el traceback al cliente
  · toda respuesta lleva la cabecera X-Request-ID
"""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.errors import DomainError, RequestIDMiddleware, register_error_handlers


@pytest.fixture(scope="module")
def app_de_prueba():
    """App mínima con los mismos handlers que producción, más rutas que fallan a propósito."""
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(RequestIDMiddleware)

    @app.get("/boom-negocio")
    def boom_negocio():
        raise DomainError("stock_insuficiente", "No hay stock suficiente", status_code=409)

    @app.get("/boom-interno")
    def boom_interno():
        # El mensaje contiene un "secreto" que JAMÁS debe salir al cliente.
        raise RuntimeError("password=SUPER_SECRETO_INTERNO en la tabla users")

    return app


@pytest.fixture(scope="module")
def client(app_de_prueba):
    # raise_server_exceptions=False: queremos ver la RESPUESTA, no que pytest reviente.
    with TestClient(app_de_prueba, raise_server_exceptions=False) as c:
        yield c


def test_error_de_negocio_usa_el_sobre_unico(client):
    r = client.get("/boom-negocio")
    assert r.status_code == 409
    error = r.json()["error"]
    assert error["code"] == "stock_insuficiente"
    assert error["message"] == "No hay stock suficiente"
    assert error["request_id"], "el sobre debe incluir un request_id no vacío"


def test_error_no_manejado_no_filtra_el_traceback(client):
    r = client.get("/boom-interno")
    assert r.status_code == 500
    cuerpo = r.text
    assert "SUPER_SECRETO_INTERNO" not in cuerpo, "¡el mensaje interno se filtró al cliente!"
    assert "Traceback" not in cuerpo and "RuntimeError" not in cuerpo
    error = r.json()["error"]
    assert error["code"] == "error_interno"
    assert error["request_id"]


def test_toda_respuesta_lleva_cabecera_request_id(client):
    r = client.get("/boom-negocio")
    assert r.headers.get("X-Request-ID") == r.json()["error"]["request_id"]


def test_request_id_entrante_se_respeta(client):
    """Permite seguir una traza que ya viene del frontend o de un proxy."""
    r = client.get("/boom-negocio", headers={"X-Request-ID": "traza-externa-123"})
    assert r.headers["X-Request-ID"] == "traza-externa-123"
    assert r.json()["error"]["request_id"] == "traza-externa-123"


def test_request_id_entrante_se_acota(client):
    """Un cliente no puede inyectar basura ilimitada en los logs."""
    r = client.get("/boom-negocio", headers={"X-Request-ID": "A" * 500})
    assert len(r.headers["X-Request-ID"]) == 64


def test_cada_peticion_recibe_un_request_id_distinto(client):
    ids = {client.get("/boom-negocio").json()["error"]["request_id"] for _ in range(5)}
    assert len(ids) == 5, "los request_id deben ser únicos por petición"
