import logging
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.tenant_context import set_tenant_db
from app.core.master_db import master_db_connection

logger = logging.getLogger(__name__)

# Cache in-memory: {slug: (db_url, is_active, timestamp)}
_tenant_cache: dict[str, tuple[str, bool, float]] = {}
_cache_lock = threading.Lock()
_CACHE_TTL = 60  # seconds


def _resolve_tenant(slug: str) -> tuple[str, bool] | None:
    now = time.time()
    with _cache_lock:
        if slug in _tenant_cache:
            db_url, is_active, ts = _tenant_cache[slug]
            if now - ts < _CACHE_TTL:
                return db_url, is_active
            del _tenant_cache[slug]

    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT db_url, is_active FROM tenants WHERE slug = %s",
                (slug,),
            )
            row = cur.fetchone()

    if row is None:
        return None

    db_url, is_active = row
    with _cache_lock:
        _tenant_cache[slug] = (db_url, is_active, now)
    return db_url, is_active


def invalidate_tenant_cache(slug: str) -> None:
    with _cache_lock:
        _tenant_cache.pop(slug, None)


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        slug = request.headers.get("X-Tenant-ID")

        if not slug:
            return await call_next(request)

        try:
            result = _resolve_tenant(slug)
        except Exception as exc:
            logger.error("Error resolviendo tenant '%s': %s", slug, exc, exc_info=True)
            return JSONResponse(
                status_code=503,
                content={"detail": "Servicio temporalmente no disponible. Intenta de nuevo en unos momentos."},
            )

        if result is None:
            return JSONResponse(
                status_code=404,
                content={"detail": f"Empresa '{slug}' no encontrada."},
            )

        db_url, is_active = result

        if not is_active:
            return JSONResponse(
                status_code=503,
                content={"detail": f"La empresa '{slug}' está temporalmente suspendida. Contacta al administrador."},
            )

        set_tenant_db(db_url)
        return await call_next(request)
