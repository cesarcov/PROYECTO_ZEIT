"""Lanzamiento por fases: las áreas sin soltar están cerradas al público.

Lo que garantiza:
  · un área en beta responde 404 a cualquiera que no sea beta tester
  · el beta tester SÍ entra
  · Logística, Admin y Solicitudes nunca se pueden cerrar
  · soltar un módulo es quitarlo de MODULOS_BETA, sin tocar código
  · un endpoint NUEVO dentro de un área beta queda cerrado automáticamente
  · los catálogos de áreas del backend y del frontend no se desincronizan
"""
import re
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.areas import (
    AREAS,
    AREAS_NO_CERRABLES,
    PREFIJOS_EXENTOS,
    area_de_ruta,
    validar_areas_beta,
)
from app.core.beta_gate import BetaGateMiddleware, es_beta_tester
from app.core.config import settings
from app.core.errors import RequestIDMiddleware, register_error_handlers
from app.core.security.auth import create_access_token

TESTER = "cesar_dev"


# ── Mapa de áreas (sin red ni base de datos) ─────────────────────────────────


@pytest.mark.parametrize(
    "ruta,esperado",
    [
        ("/logistics", "logistica"),
        ("/logistics/stock", "logistica"),
        ("/cotizaciones/baules", "cotizaciones"),
        ("/compras/oc/123", "compras"),
        ("/ot/55/cerrar", "operaciones"),
        ("/operations/plans", "operaciones"),
        ("/gerencia/aprobaciones", "gerencia"),
        ("/clientes", "clientes"),
        ("/canal/solicitudes", "canal"),
        ("/planificacion/actividades", "planificacion"),
        ("/requerimientos/9", "requerimientos"),
        ("/admin/users", "admin"),
    ],
)
def test_cada_ruta_cae_en_su_area(ruta, esperado):
    assert area_de_ruta(ruta) == esperado


@pytest.mark.parametrize("ruta", ["/", "/health", "/auth/login", "/branding", "/superadmin/tenants"])
def test_las_rutas_exentas_no_tienen_area(ruta):
    assert area_de_ruta(ruta) is None, f"{ruta} debe quedar siempre abierta"


def test_la_comparacion_es_por_segmento_no_por_texto():
    """'/clientes' no debe capturar '/clientesfalsos'."""
    assert area_de_ruta("/clientes") == "clientes"
    assert area_de_ruta("/clientes/7") == "clientes"
    assert area_de_ruta("/clientesfalsos") is None


# ── Validación de lo que se declara en MODULOS_BETA ──────────────────────────


def test_un_area_inventada_se_ignora_y_avisa():
    """Un nombre mal escrito dejaría el módulo abierto creyéndolo cerrado."""
    validas, avisos = validar_areas_beta(["cotizacionez"])
    assert validas == []
    assert any("no es un área conocida" in a for a in avisos)


@pytest.mark.parametrize("area", sorted(AREAS_NO_CERRABLES))
def test_las_areas_nucleo_no_se_pueden_cerrar(area):
    """Cerrar Logística o Admin dejaría el ERP inservible."""
    validas, avisos = validar_areas_beta([area])
    assert validas == []
    assert any("no se puede poner en beta" in a for a in avisos)


def test_un_area_valida_se_acepta():
    validas, avisos = validar_areas_beta(["cotizaciones", "compras"])
    assert validas == ["cotizaciones", "compras"]
    assert avisos == []


# ── Quién es beta tester ─────────────────────────────────────────────────────


def test_el_superadmin_siempre_es_tester(monkeypatch):
    monkeypatch.setattr(settings, "BETA_TESTERS", "")
    assert es_beta_tester(None, role="superadmin") is True


def test_un_usuario_de_la_lista_es_tester(monkeypatch):
    monkeypatch.setattr(settings, "BETA_TESTERS", f"otro,{TESTER}")
    assert es_beta_tester(TESTER) is True


def test_la_lista_no_distingue_mayusculas_ni_espacios(monkeypatch):
    monkeypatch.setattr(settings, "BETA_TESTERS", f"  {TESTER.upper()}  ")
    assert es_beta_tester(TESTER) is True


def test_un_admin_que_no_este_en_la_lista_no_es_tester(monkeypatch):
    """Ser administrador NO da acceso a lo que no está soltado."""
    monkeypatch.setattr(settings, "BETA_TESTERS", TESTER)
    assert es_beta_tester("admin") is False


def test_un_anonimo_no_es_tester(monkeypatch):
    monkeypatch.setattr(settings, "BETA_TESTERS", TESTER)
    assert es_beta_tester(None) is False


# ── El middleware, contra una app de juguete ─────────────────────────────────


@pytest.fixture
def app_con_gate(monkeypatch):
    """App mínima con el gate y una ruta por cada prefijo real. Sin base de datos."""
    monkeypatch.setattr(settings, "MODULOS_BETA", "cotizaciones,compras,gerencia")
    monkeypatch.setattr(settings, "BETA_TESTERS", TESTER)

    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(BetaGateMiddleware)
    app.add_middleware(RequestIDMiddleware)

    rutas = [
        "/logistics/stock", "/admin/users", "/requests/my",
        "/cotizaciones", "/compras/oc", "/gerencia/aprobaciones",
        "/operations/plans", "/health", "/branding",
    ]
    for ruta in rutas:
        app.add_api_route(ruta, lambda: {"ok": True}, methods=["GET"])

    return app


@pytest.fixture
def client(app_con_gate):
    with TestClient(app_con_gate) as c:
        yield c


@pytest.fixture
def cabecera_tester():
    token = create_access_token(
        user_id="00000000-0000-0000-0000-000000000001",
        permissions=[],
        username=TESTER,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def cabecera_normal():
    token = create_access_token(
        user_id="00000000-0000-0000-0000-000000000002",
        permissions=["admin:users"],
        username="empleado_normal",
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.parametrize("ruta", ["/cotizaciones", "/compras/oc", "/gerencia/aprobaciones"])
def test_un_area_en_beta_responde_404_a_un_anonimo(client, ruta):
    assert client.get(ruta).status_code == 404


@pytest.mark.parametrize("ruta", ["/cotizaciones", "/compras/oc", "/gerencia/aprobaciones"])
def test_un_area_en_beta_responde_404_a_un_usuario_normal(client, ruta, cabecera_normal):
    r = client.get(ruta, headers=cabecera_normal)
    assert r.status_code == 404, "un usuario con sesión no debe poder entrar a lo no soltado"


def test_el_404_no_revela_que_el_modulo_existe(client, cabecera_normal):
    """Un 403 confirmaría que hay algo ahí; un 404 no cuenta nada."""
    r = client.get("/cotizaciones", headers=cabecera_normal)
    cuerpo = r.text.lower()
    assert "beta" not in cuerpo
    assert "permiso" not in cuerpo
    assert r.json()["error"]["code"] == "no_encontrado"


@pytest.mark.parametrize("ruta", ["/cotizaciones", "/compras/oc", "/gerencia/aprobaciones"])
def test_el_beta_tester_si_entra(client, ruta, cabecera_tester):
    r = client.get(ruta, headers=cabecera_tester)
    assert r.status_code == 200, f"el beta tester debe poder probar {ruta}"


@pytest.mark.parametrize("ruta", ["/logistics/stock", "/admin/users", "/requests/my"])
def test_las_areas_publicas_siguen_abiertas(client, ruta, cabecera_normal):
    assert client.get(ruta, headers=cabecera_normal).status_code == 200


def test_un_area_no_declarada_beta_sigue_abierta(client, cabecera_normal):
    """`operaciones` no está en la lista de este test: debe responder normal."""
    assert client.get("/operations/plans", headers=cabecera_normal).status_code == 200


@pytest.mark.parametrize("ruta", ["/health", "/branding"])
def test_las_rutas_exentas_responden_sin_token(client, ruta):
    assert client.get(ruta).status_code == 200


def test_un_token_invalido_se_trata_como_anonimo(client):
    r = client.get("/cotizaciones", headers={"Authorization": "Bearer no.es.un.jwt"})
    assert r.status_code == 404


def test_un_token_firmado_con_otra_clave_no_abre_la_beta(client):
    """Forjar un token con username de tester no sirve: la firma no cuadra."""
    from jose import jwt

    falso = jwt.encode({"username": TESTER}, "clave-del-atacante", algorithm="HS256")
    r = client.get("/cotizaciones", headers={"Authorization": f"Bearer {falso}"})
    assert r.status_code == 404


# ── Soltar un módulo al público ──────────────────────────────────────────────


def test_soltar_un_modulo_es_quitarlo_de_la_lista(monkeypatch, cabecera_normal):
    """El flujo de release completo, sin tocar una línea de código."""
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(BetaGateMiddleware)
    app.add_middleware(RequestIDMiddleware)
    app.add_api_route("/cotizaciones", lambda: {"ok": True}, methods=["GET"])

    monkeypatch.setattr(settings, "BETA_TESTERS", TESTER)

    # Antes del release: cerrado.
    monkeypatch.setattr(settings, "MODULOS_BETA", "cotizaciones,compras")
    with TestClient(app) as c:
        assert c.get("/cotizaciones", headers=cabecera_normal).status_code == 404

    # Se quita 'cotizaciones' de la lista y se redespliega: abierto.
    monkeypatch.setattr(settings, "MODULOS_BETA", "compras")
    with TestClient(app) as c:
        assert c.get("/cotizaciones", headers=cabecera_normal).status_code == 200


def test_sin_nada_en_beta_el_gate_no_estorba(monkeypatch, cabecera_normal):
    """Con MODULOS_BETA vacío el sistema se comporta como si el gate no existiera."""
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(BetaGateMiddleware)
    app.add_middleware(RequestIDMiddleware)
    for ruta in ("/cotizaciones", "/compras/oc", "/gerencia/aprobaciones"):
        app.add_api_route(ruta, lambda: {"ok": True}, methods=["GET"])

    monkeypatch.setattr(settings, "MODULOS_BETA", "")
    with TestClient(app) as c:
        for ruta in ("/cotizaciones", "/compras/oc", "/gerencia/aprobaciones"):
            assert c.get(ruta, headers=cabecera_normal).status_code == 200


def test_un_endpoint_nuevo_en_un_area_beta_queda_cerrado_solo(monkeypatch, cabecera_normal):
    """Nadie tiene que acordarse de nada: el gate es por prefijo, no por endpoint."""
    app = FastAPI()
    register_error_handlers(app)
    app.add_middleware(BetaGateMiddleware)
    app.add_middleware(RequestIDMiddleware)
    # Endpoint recién inventado, que nadie marcó como beta.
    app.add_api_route("/cotizaciones/reporte-flamante", lambda: {"ok": True}, methods=["GET"])

    monkeypatch.setattr(settings, "MODULOS_BETA", "cotizaciones")
    monkeypatch.setattr(settings, "BETA_TESTERS", TESTER)
    with TestClient(app) as c:
        assert c.get("/cotizaciones/reporte-flamante", headers=cabecera_normal).status_code == 404


# ── Backend y frontend no se desincronizan ───────────────────────────────────


def test_el_frontend_conoce_las_mismas_areas():
    """`areas.js` es el espejo de `areas.py`: si una cambia, la otra también."""
    js = Path("frontend/myapp/src/constants/areas.js").read_text(encoding="utf-8")

    bloque = re.search(r"AREA_RUTAS\s*=\s*\{(.*?)\n\};", js, re.DOTALL)
    assert bloque, "no se encontró AREA_RUTAS en areas.js"
    areas_js = set(re.findall(r"^\s{2}(\w+):", bloque.group(1), re.MULTILINE))

    faltan_en_js = sorted(set(AREAS) - areas_js)
    sobran_en_js = sorted(areas_js - set(AREAS))

    assert not faltan_en_js, (
        f"estas áreas existen en areas.py pero no en areas.js: {faltan_en_js}. "
        "El sidebar no sabría ocultarlas."
    )
    assert not sobran_en_js, (
        f"estas áreas existen en areas.js pero no en areas.py: {sobran_en_js}. "
        "El backend no las cerraría."
    )


def test_ninguna_area_declara_un_prefijo_exento():
    """Si un área reclamara /auth o /health, el gate podría cerrar el login."""
    colisiones = []
    for area, prefijos in AREAS.items():
        for prefijo in prefijos:
            if prefijo in PREFIJOS_EXENTOS:
                colisiones.append(f"{area} -> {prefijo}")
    assert not colisiones, f"áreas que pisan un prefijo exento: {colisiones}"


def test_dos_areas_no_comparten_prefijo():
    """Un prefijo en dos áreas haría el cierre impredecible."""
    visto: dict[str, str] = {}
    duplicados = []
    for area, prefijos in AREAS.items():
        for prefijo in prefijos:
            if prefijo in visto:
                duplicados.append(f"'{prefijo}' en '{visto[prefijo]}' y en '{area}'")
            visto[prefijo] = area
    assert not duplicados, f"prefijos duplicados: {duplicados}"
