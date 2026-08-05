"""F-000 / T-14 — rate limiting, bloqueo por usuario y cabeceras de seguridad.

Criterio de aceptación: "el 6.º intento de login en un minuto recibe 429".
"""
import pytest

from app.core import login_guard
from app.core.config import settings


@pytest.fixture(autouse=True)
def estado_limpio():
    """Cada test arranca sin historial de intentos fallidos."""
    login_guard.reiniciar()
    yield
    login_guard.reiniciar()


# ── Bloqueo incremental por usuario ──────────────────────────────────────────


def test_los_primeros_fallos_no_bloquean():
    """Un usuario que se equivoca un par de veces no debe quedar fuera."""
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS - 1):
        assert login_guard.registrar_fallo("ana") == 0
    assert login_guard.segundos_de_bloqueo("ana") == 0


def test_el_intento_que_excede_el_limite_bloquea():
    """EL criterio de T-14: pasado el umbral, el siguiente intento se bloquea."""
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        login_guard.registrar_fallo("ana")

    espera = login_guard.registrar_fallo("ana")
    assert espera > 0, "tras superar el umbral el usuario debe quedar bloqueado"
    assert login_guard.segundos_de_bloqueo("ana") > 0


def test_la_espera_se_duplica_en_cada_intento():
    """Bloqueo incremental: cada fallo adicional cuesta el doble."""
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS):
        login_guard.registrar_fallo("ana")

    primera = login_guard.registrar_fallo("ana")
    segunda = login_guard.registrar_fallo("ana")
    tercera = login_guard.registrar_fallo("ana")

    assert segunda == primera * 2
    assert tercera == segunda * 2


def test_la_espera_tiene_techo():
    """Un atacante no puede dejar a un usuario legítimo bloqueado para siempre."""
    for _ in range(60):
        espera = login_guard.registrar_fallo("ana")
    assert espera == login_guard.TECHO_SEGUNDOS


def test_un_login_correcto_limpia_el_contador():
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS + 1):
        login_guard.registrar_fallo("ana")
    assert login_guard.segundos_de_bloqueo("ana") > 0

    login_guard.registrar_exito("ana")
    assert login_guard.segundos_de_bloqueo("ana") == 0


def test_el_bloqueo_es_por_usuario_no_global():
    """Bloquear a 'ana' no debe dejar fuera a 'beto'."""
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS + 1):
        login_guard.registrar_fallo("ana")

    assert login_guard.segundos_de_bloqueo("ana") > 0
    assert login_guard.segundos_de_bloqueo("beto") == 0


def test_el_usuario_no_distingue_mayusculas_ni_espacios():
    """'Ana ' y 'ana' son la misma cuenta: si no, el bloqueo se esquiva trivialmente."""
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS + 1):
        login_guard.registrar_fallo("ana")

    assert login_guard.segundos_de_bloqueo("  ANA  ") > 0


def test_un_usuario_vacio_no_rompe_nada():
    assert login_guard.registrar_fallo("") == 0
    assert login_guard.segundos_de_bloqueo("") == 0


# ── Integración con el endpoint ──────────────────────────────────────────────


@pytest.mark.db
def test_el_login_devuelve_429_tras_superar_el_umbral(client):
    """Recorrido real contra el endpoint: 401... y luego 429 con Retry-After."""
    usuario = "usuario_inexistente_para_probar_bloqueo"

    vistos = []
    for _ in range(settings.LOGIN_MAX_FAILED_ATTEMPTS + 3):
        r = client.post("/auth/login", data={"username": usuario, "password": "mala"})
        vistos.append(r.status_code)
        if r.status_code == 429:
            assert r.headers.get("Retry-After"), "un 429 debe decir cuándo reintentar"
            break

    assert 429 in vistos, f"nunca llegó el 429; se vieron {vistos}"


# ── Cabeceras de seguridad ───────────────────────────────────────────────────


@pytest.mark.db
@pytest.mark.parametrize(
    "cabecera,esperado",
    [
        ("X-Content-Type-Options", "nosniff"),
        ("X-Frame-Options", "DENY"),
        ("Referrer-Policy", "strict-origin-when-cross-origin"),
    ],
)
def test_las_cabeceras_de_seguridad_estan_presentes(client, cabecera, esperado):
    r = client.get("/health")
    assert r.headers.get(cabecera) == esperado


@pytest.mark.db
def test_hay_content_security_policy(client):
    csp = client.get("/health").headers.get("Content-Security-Policy", "")
    assert csp, "falta la cabecera Content-Security-Policy"
    assert "frame-ancestors 'none'" in csp, "la CSP debe impedir el clickjacking"


@pytest.mark.db
def test_no_se_envia_hsts_fuera_de_produccion(client):
    """En http://localhost, HSTS dejaría el navegador del desarrollador inservible."""
    if settings.is_production:
        pytest.skip("este test comprueba el comportamiento fuera de producción")
    assert "Strict-Transport-Security" not in client.get("/health").headers


# ── CORS estricto ────────────────────────────────────────────────────────────


def test_en_produccion_no_se_permiten_origenes_locales():
    """Un origen localhost aceptado en producción es un agujero de CORS."""
    from app.core.config import Settings

    produccion = Settings(
        ENV="production",
        SECRET_KEY="x" * 40,
        DATABASE_URL="postgresql://u:p@h:5432/d",
        CORS_ORIGINS="https://proyecto-zeit.vercel.app",
    )
    origenes = produccion.cors_origins_list

    assert origenes == ["https://proyecto-zeit.vercel.app"]
    assert not any("localhost" in o or "127.0.0.1" in o for o in origenes)


def test_en_desarrollo_si_se_permiten_los_puertos_de_vite():
    from app.core.config import Settings

    desarrollo = Settings(
        ENV="development",
        SECRET_KEY="x" * 40,
        DATABASE_URL="postgresql://u:p@h:5432/d",
        CORS_ORIGINS="",
    )
    assert "http://localhost:5173" in desarrollo.cors_origins_list


def test_los_origenes_se_normalizan_sin_barra_final():
    """'https://x.com/' y 'https://x.com' deben ser el mismo origen."""
    from app.core.config import Settings

    s = Settings(
        ENV="production",
        SECRET_KEY="x" * 40,
        DATABASE_URL="postgresql://u:p@h:5432/d",
        CORS_ORIGINS="https://a.com/, https://b.com , https://a.com",
    )
    assert s.cors_origins_list == ["https://a.com", "https://b.com"]
