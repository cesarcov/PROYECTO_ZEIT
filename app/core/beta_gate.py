"""Cierre de las áreas aún no soltadas al público.

Lanzamiento por fases: mientras un módulo está en `MODULOS_BETA`, sus rutas
responden **404** a todo el mundo salvo a los beta testers. Para el resto de
usuarios, ese módulo simplemente no existe.

Por qué 404 y no 403: un 403 confirma que la ruta existe y que hay algo ahí
detrás. Un 404 no cuenta nada de lo que aún no está listo para mostrarse.

Por qué es un MIDDLEWARE y no una dependencia por endpoint: son 16 prefijos y
~200 endpoints. Un punto único es verificable de un vistazo; 200 decoradores
se olvidan. Además así un endpoint NUEVO dentro de un área beta queda cerrado
automáticamente, sin que nadie tenga que acordarse.

Esto NO sustituye al RBAC: es una capa de lanzamiento, no de autorización. Un
área pública sigue exigiendo los permisos que exija.
"""
import logging

from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.areas import area_de_ruta
from app.core.config import settings
from app.core.errors import error_response

logger = logging.getLogger(__name__)


def es_beta_tester(username: str | None, role: str | None = None) -> bool:
    """¿Este usuario ve las áreas en beta?"""
    if role == "superadmin":
        return True
    if not username:
        return False
    return username.strip().lower() in settings.beta_testers_list


def _identidad_del_token(request: Request) -> tuple[str | None, str | None]:
    """(username, role) del Bearer token, o (None, None) si no hay o no vale.

    El middleware corre ANTES de que FastAPI resuelva las dependencias, así que
    aquí no existe `get_current_user`. Se decodifica el token sólo para saber
    si quien llama es beta tester; la autenticación de verdad la sigue haciendo
    `get_current_user` después, como siempre.
    """
    cabecera = request.headers.get("Authorization", "")
    if not cabecera.lower().startswith("bearer "):
        return None, None

    token = cabecera[7:].strip()
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        # Token inválido o caducado: se trata como anónimo. El 401 real lo
        # devolverá el endpoint si el área no está cerrada.
        return None, None

    return payload.get("username"), payload.get("role")


class BetaGateMiddleware(BaseHTTPMiddleware):
    """Devuelve 404 en las rutas de áreas que aún no se han soltado."""

    async def dispatch(self, request: Request, call_next):
        areas_beta = settings.modulos_beta_list
        if not areas_beta:
            # Nada en beta: el middleware no hace nada (todo soltado).
            return await call_next(request)

        area = area_de_ruta(request.url.path)
        if area is None or area not in areas_beta:
            return await call_next(request)

        username, role = _identidad_del_token(request)
        if es_beta_tester(username, role):
            request.state.beta_tester = True
            return await call_next(request)

        logger.info(
            "Beta gate: %s %s bloqueado (área '%s' sin soltar, usuario '%s')",
            request.method, request.url.path, area, username or "anónimo",
        )
        return error_response(
            request,
            "no_encontrado",
            "Recurso no encontrado.",
            404,
        )
