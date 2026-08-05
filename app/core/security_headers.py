"""Cabeceras de seguridad de toda respuesta del API.

F-000 / T-14. Qué previene cada una:

  · X-Content-Type-Options        el navegador no adivina el tipo de un archivo
                                  subido (un .png con HTML dentro no se ejecuta)
  · X-Frame-Options               nadie puede embeber el ERP en un iframe
    + CSP frame-ancestors         (clickjacking); la CSP es la versión moderna
  · Referrer-Policy               las URLs internas no viajan a sitios externos
  · Permissions-Policy            se apagan cámara, micrófono y geolocalización
  · Strict-Transport-Security     el navegador exige HTTPS (sólo en producción)
  · Content-Security-Policy       el backend sólo devuelve JSON e imágenes; no
                                  hay razón para permitir scripts
"""
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import settings

# CSP de un API: no sirve HTML propio, así que se prohíbe todo salvo las
# imágenes que él mismo entrega en /branding-assets y /avatar-assets.
_CSP_PRODUCCION = (
    "default-src 'none'; "
    "img-src 'self' data:; "
    "frame-ancestors 'none'; "
    "base-uri 'none'; "
    "form-action 'none'"
)

# En desarrollo /docs y /redoc cargan Swagger UI desde un CDN. Se relaja lo
# justo para que la documentación interactiva siga funcionando.
_CSP_DESARROLLO = (
    "default-src 'self'; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "
    "frame-ancestors 'none'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)

        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        response.headers["Content-Security-Policy"] = (
            _CSP_PRODUCCION if settings.is_production else _CSP_DESARROLLO
        )
        response.headers["Cross-Origin-Resource-Policy"] = "same-site"

        # HSTS sólo bajo HTTPS: en desarrollo (http://localhost) forzaría al
        # navegador a intentar HTTPS contra un servidor que no lo habla.
        if settings.is_production:
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains; preload"
            )

        return response
