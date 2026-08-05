import logging
import os
import time
from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.rate_limit import limiter
from app.core.security_headers import SecurityHeadersMiddleware
from app.core.tenant_middleware import TenantMiddleware
from app.core.scheduler import start_scheduler, stop_scheduler
from app.modules.admin.router import router as admin_router
from app.core.security.router import router as auth_router
from app.modules.logistics.router import router as logistics_router
from app.modules.logistics.router_lots import router as lots_router
from app.modules.logistics.router_transfers import router as transfers_router
from app.modules.logistics.router_physical_inv import router as physical_inv_router
from app.modules.logistics.router_advanced import router as advanced_router
from app.core.audit.middleware import AuditMiddleware
from app.modules.requests.router import router as requests_router
from app.modules.reporting.router import router as reporting_router
from app.modules.operations.router import router as operations_router
from app.modules.canal.router import router as canal_router
from app.modules.cotizaciones.router import router as cotizaciones_router
from app.modules.ordenes_trabajo.router import router as ot_router
from app.modules.compras.router import router as compras_router
from app.modules.clientes.router import router as clientes_router
from app.modules.planificacion.router import router as planificacion_router
from app.modules.gerencia.router import router as gerencia_router
from app.modules.requerimientos.router import router as requerimientos_router
from app.modules.branding.router import router as branding_router
from app.modules.superadmin.router import router as superadmin_router
from app.modules.search.router import router as search_router
from app.core.config import settings
from app.core.database import db_connection, pool_stats
from app.core.errors import RequestIDMiddleware, rate_limit_handler, register_error_handlers
from app.core.observability import init_sentry
from app.core.storage import almacenamiento_es_persistente

logger = logging.getLogger(__name__)

# Sentry se inicializa ANTES de crear la app para que instrumente todo el
# arranque, incluido el lifespan (F-000 / T-04). Sin SENTRY_DSN es un no-op.
init_sentry()

from contextlib import asynccontextmanager

_dev = not settings.is_production
_start_time = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
        print("[OK] Base de datos conectada correctamente.")
    except Exception as e:
        print(f"[ERROR] Conexion a la base de datos fallida: {e}")
        print("  Verifica DATABASE_URL en tu archivo .env")
        raise SystemExit(1)
    start_scheduler()
    
    yield
    
    # Shutdown
    stop_scheduler()


app = FastAPI(
    title="ERP Modular",
    docs_url="/docs" if _dev else None,
    redoc_url="/redoc" if _dev else None,
    openapi_url="/openapi.json" if _dev else None,
    lifespan=lifespan,
)


# Sobre único de errores + request_id (F-000 / T-03). Todo error del API sale
# con la forma {"error":{"code","message","request_id"}}; los no controlados
# nunca filtran el traceback al cliente.
register_error_handlers(app)


# ===============================
# CORS (FRONTEND)
# ===============================
# Orígenes EXACTOS. En producción sólo los declarados en CORS_ORIGINS; en
# desarrollo `settings` añade además los puertos locales de Vite (F-000 / T-14).
origins = settings.cors_origins_list

app.state.limiter = limiter
# Handler propio en vez del de slowapi: devuelve el sobre único y la cabecera
# Retry-After, que el suyo no incluye (F-000 / T-14).
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

# Orden de middlewares (último en add_middleware = primero en ejecutarse):
# RequestID (outermost) → CORS → Audit → SlowAPI → Tenant → SecurityHeaders.
# RequestID se añade el último a propósito: al quedar el más externo, cualquier
# error nacido en cualquier capa ya tiene su `request_id` cuando el handler
# construye el sobre.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Tenant-ID", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(RequestIDMiddleware)

# ===============================
# ROUTERS
# ===============================
app.include_router(auth_router)
app.include_router(admin_router)
app.include_router(requests_router)
app.include_router(logistics_router)
app.include_router(lots_router)
app.include_router(transfers_router)
app.include_router(physical_inv_router)
app.include_router(advanced_router)
app.include_router(reporting_router)
app.include_router(operations_router)
app.include_router(canal_router)
app.include_router(cotizaciones_router)
app.include_router(ot_router)
app.include_router(compras_router)
app.include_router(clientes_router)
app.include_router(planificacion_router)
app.include_router(gerencia_router)
app.include_router(requerimientos_router)
app.include_router(branding_router)
app.include_router(superadmin_router)
app.include_router(search_router)

# Estáticos de marca (logos subidos). El directorio es de runtime (gitignored).
_BRANDING_DIR = os.path.join("app", "storage", "branding")
os.makedirs(_BRANDING_DIR, exist_ok=True)
app.mount("/branding-assets", StaticFiles(directory=_BRANDING_DIR), name="branding-assets")

# Estáticos de avatares de usuario. El directorio es de runtime (gitignored).
_AVATARS_DIR = os.path.join("app", "storage", "avatars")
os.makedirs(_AVATARS_DIR, exist_ok=True)
app.mount("/avatar-assets", StaticFiles(directory=_AVATARS_DIR), name="avatar-assets")


@app.get("/")
def root():
    return {"message": "ERP running"}


@app.get("/health")
def health_check(response: Response):
    """Estado real del servicio — F-000 / T-05.

    Devuelve 503 si la base de datos no responde, para que el monitor externo
    (UptimeRobot) avise en vez de ver un 200 mentiroso. Los pings periódicos del
    monitor además sirven de keep-alive y reducen los cold starts de Render.
    """
    db_ok = False
    db_error = None
    inicio = time.perf_counter()
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                db_ok = cur.fetchone()[0] == 1
    except Exception as exc:
        # El detalle va a los logs; al cliente sólo el tipo de fallo, sin credenciales.
        logger.error("Health check: la base de datos no responde: %s", exc)
        db_error = type(exc).__name__
    db_latency_ms = round((time.perf_counter() - inicio) * 1000, 1)

    cuerpo = {
        "status": "ok" if db_ok else "unhealthy",
        "db": "ok" if db_ok else "error",
        "db_latency_ms": db_latency_ms,
        "pool": pool_stats(),
        # OBJ-5: en false, los logos y avatares subidos se pierden en el
        # próximo redeploy de Render (disco efímero).
        "storage_persistente": almacenamiento_es_persistente(),
        "uptime_seconds": int(time.time() - _start_time),
        "version": settings.GIT_COMMIT,
        "env": settings.ENV,
    }
    if db_error:
        cuerpo["db_error"] = db_error

    response.status_code = 200 if db_ok else 503
    return cuerpo
