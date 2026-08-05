"""Observabilidad: inicialización de Sentry y correlación con el request-id.

F-000 / T-04 — Sentry es OPCIONAL: si `SENTRY_DSN` está vacío (el caso por
defecto en desarrollo), todo aquí es un no-op y el backend se comporta igual
que sin la dependencia. Nada en el resto del código necesita saber si Sentry
está activo o no.

Cada evento que llega a Sentry lleva el tag `request_id`, que es el mismo
identificador que el cliente recibió en la cabecera `X-Request-ID` y en el
sobre de error. Así, un usuario que reporta "me salió el error abc123" se
resuelve buscando ese tag en el panel.
"""
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)

_sentry_activo = False


def init_sentry() -> bool:
    """Arranca Sentry si hay DSN configurado. Devuelve True si quedó activo."""
    global _sentry_activo

    if not settings.SENTRY_DSN:
        logger.info("Sentry desactivado (SENTRY_DSN vacío).")
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.starlette import StarletteIntegration
    except ImportError:
        logger.warning("SENTRY_DSN configurado pero sentry-sdk no está instalado.")
        return False

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        environment=settings.ENV,
        release=settings.GIT_COMMIT,
        traces_sample_rate=settings.SENTRY_TRACES_SAMPLE_RATE,
        # No enviar cuerpos de petición ni cabeceras: pueden contener
        # contraseñas, tokens y datos personales de clientes.
        send_default_pii=False,
        max_request_body_size="never",
        before_send=_scrub,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )
    _sentry_activo = True
    logger.info("Sentry activo (entorno=%s, release=%s).", settings.ENV, settings.GIT_COMMIT)
    return True


_CABECERAS_SENSIBLES = {"authorization", "cookie", "x-tenant-id", "set-cookie"}


def _scrub(event: dict, _hint: dict) -> dict:
    """Última red de seguridad: borra cabeceras sensibles antes de salir del proceso."""
    cabeceras = event.get("request", {}).get("headers")
    if isinstance(cabeceras, dict):
        for nombre in list(cabeceras):
            if nombre.lower() in _CABECERAS_SENSIBLES:
                cabeceras[nombre] = "[filtrado]"
    return event


def tag_request(request_id: str) -> None:
    """Etiqueta el scope actual con el request_id. No-op si Sentry está apagado."""
    if not _sentry_activo:
        return
    try:
        import sentry_sdk

        sentry_sdk.get_isolation_scope().set_tag("request_id", request_id)
    except Exception:  # nunca romper una petición por culpa de la telemetría
        logger.debug("No se pudo etiquetar el request_id en Sentry", exc_info=True)


def capture_exception(exc: Exception) -> None:
    """Envía una excepción a Sentry. No-op si está apagado."""
    if not _sentry_activo:
        return
    try:
        import sentry_sdk

        sentry_sdk.capture_exception(exc)
    except Exception:
        logger.debug("No se pudo enviar la excepción a Sentry", exc_info=True)
