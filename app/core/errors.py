"""Sobre único de errores y correlación por request-id.

F-000 / T-03 — todo error que sale del API tiene la MISMA forma:

    {"error": {"code": "...", "message": "...", "request_id": "..."}}

Un error no manejado nunca filtra el traceback ni el mensaje interno al
cliente: se registra completo en los logs (con su `request_id`) y al usuario
sólo le llega un mensaje genérico más ese identificador, que es lo que necesita
para reportar el incidente.

Uso desde la capa de negocio:

    from app.core.errors import DomainError
    raise DomainError("stock_insuficiente", "No hay stock suficiente", status_code=409)
"""
import logging
import uuid

from fastapi import HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.observability import tag_request

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"


class DomainError(Exception):
    """Error de negocio esperado. Su `message` SÍ es seguro de mostrar al usuario.

    `code` es un identificador estable en snake_case que el frontend puede
    interpretar sin parsear texto (p. ej. "stock_insuficiente").
    """

    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: dict | None = None,
    ):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def get_request_id(request: Request) -> str:
    """Identificador de la petición actual. Siempre devuelve algo utilizable."""
    return getattr(request.state, "request_id", None) or "-"


def error_response(
    request: Request,
    code: str,
    message: str,
    status_code: int,
    details: dict | None = None,
) -> JSONResponse:
    """Construye el sobre único. Es el ÚNICO sitio que decide la forma del error."""
    body: dict = {
        "error": {
            "code": code,
            "message": message,
            "request_id": get_request_id(request),
        },
        # COMPATIBILIDAD: el frontend actual lee `err.detail` en ~40 sitios.
        # Se mantiene hasta que todos migren a `err.error.message`. No añadir
        # código nuevo que dependa de este campo.
        "detail": message,
    }
    if details:
        body["error"]["details"] = details
    return JSONResponse(
        status_code=status_code,
        content=body,
        headers={REQUEST_ID_HEADER: get_request_id(request)},
    )


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Inyecta `request.state.request_id` y lo devuelve en la cabecera de respuesta.

    Respeta un `X-Request-ID` entrante (para poder seguir una traza que ya venga
    del frontend o de un proxy); si no viene, genera uno nuevo.
    """

    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get(REQUEST_ID_HEADER, "").strip()
        # Se acota la longitud para que un cliente no pueda inyectar basura en los logs.
        request_id = incoming[:64] if incoming else uuid.uuid4().hex[:16]
        request.state.request_id = request_id
        # Mismo identificador en Sentry: buscar por este tag lleva al incidente.
        tag_request(request_id)
        response = await call_next(request)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response


# ── Handlers globales ────────────────────────────────────────────────────────


async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
    logger.info(
        "DomainError [%s] %s %s -> %s: %s",
        get_request_id(request), request.method, request.url.path, exc.code, exc.message,
    )
    return error_response(request, exc.code, exc.message, exc.status_code, exc.details)


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Traduce las HTTPException existentes al sobre único sin tocar sus llamadores."""
    code = _CODE_BY_STATUS.get(exc.status_code, "http_error")
    detail = exc.detail if isinstance(exc.detail, str) else "Error en la petición"
    response = error_response(request, code, detail, exc.status_code)
    # Preserva cabeceras propias del error (p. ej. WWW-Authenticate en los 401).
    for key, value in (exc.headers or {}).items():
        response.headers[key] = value
    return response


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """422 de Pydantic: se informa qué campo falla, sin exponer la estructura interna."""
    campos = []
    for err in exc.errors():
        ubicacion = ".".join(str(p) for p in err.get("loc", []) if p != "body")
        campos.append({"campo": ubicacion or "(cuerpo)", "problema": err.get("msg", "")})
    return error_response(
        request,
        "validacion_fallida",
        "Los datos enviados no son válidos.",
        status.HTTP_422_UNPROCESSABLE_ENTITY,
        {"campos": campos},
    )


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Último recurso: se loguea TODO y al cliente sólo le llega el request_id."""
    logger.exception(
        "Error no controlado [%s] %s %s: %s",
        get_request_id(request), request.method, request.url.path, exc,
    )
    return error_response(
        request,
        "error_interno",
        "Error interno del servidor. Reporta este identificador al equipo técnico.",
        status.HTTP_500_INTERNAL_SERVER_ERROR,
    )


async def rate_limit_handler(request: Request, exc) -> JSONResponse:
    """429 de slowapi (límite por IP) con el sobre único y `Retry-After`.

    El handler que trae slowapi devuelve texto plano y sin `Retry-After`, así
    que el cliente no sabe cuándo reintentar (F-000 / T-14).
    """
    segundos = _ventana_del_limite(exc)
    respuesta = error_response(
        request,
        "demasiadas_peticiones",
        f"Demasiadas peticiones. Vuelve a intentarlo en {segundos} segundo(s).",
        status.HTTP_429_TOO_MANY_REQUESTS,
    )
    respuesta.headers["Retry-After"] = str(segundos)
    return respuesta


def _ventana_del_limite(exc) -> int:
    """Duración de la ventana del límite excedido, en segundos. 60 por defecto."""
    try:
        item = exc.limit.limit
        return int(item.GRANULARITY.seconds * item.multiples)
    except Exception:
        return 60


_CODE_BY_STATUS = {
    400: "peticion_invalida",
    401: "no_autenticado",
    403: "sin_permisos",
    404: "no_encontrado",
    409: "conflicto",
    422: "validacion_fallida",
    429: "demasiadas_peticiones",
    503: "servicio_no_disponible",
}


def register_error_handlers(app) -> None:
    """Registra los handlers globales. Se llama una sola vez desde `app/main.py`."""
    app.add_exception_handler(DomainError, domain_error_handler)
    app.add_exception_handler(HTTPException, http_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(Exception, unhandled_exception_handler)
