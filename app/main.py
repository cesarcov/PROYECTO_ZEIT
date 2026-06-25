import logging
import os
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
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
from app.core.database import db_connection

logger = logging.getLogger(__name__)

_dev = os.getenv("ENV", "development") != "production"
_start_time = time.time()

app = FastAPI(
    title="ERP Modular",
    docs_url="/docs" if _dev else None,
    redoc_url="/redoc" if _dev else None,
    openapi_url="/openapi.json" if _dev else None,
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Error no controlado en %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor. Revisa los logs del API."},
    )


@app.on_event("startup")
def startup_check():
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


@app.on_event("shutdown")
def shutdown_event():
    stop_scheduler()

# ===============================
# CORS (FRONTEND)
# ===============================
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Orden de middlewares (último en add_middleware = primero en ejecutarse):
# SecurityHeaders → Tenant → SlowAPI → Audit → CORS (outermost, maneja preflight)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Tenant-ID"],
)

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

# Estáticos de marca (logos subidos). El directorio es de runtime (gitignored).
_BRANDING_DIR = os.path.join("app", "storage", "branding")
os.makedirs(_BRANDING_DIR, exist_ok=True)
app.mount("/branding-assets", StaticFiles(directory=_BRANDING_DIR), name="branding-assets")


@app.get("/")
def root():
    return {"message": "ERP running"}


@app.get("/health")
def health_check():
    db_ok = False
    try:
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                db_ok = cur.fetchone()[0] == 1
    except Exception:
        pass
    uptime_seconds = int(time.time() - _start_time)
    status = "ok" if db_ok else "degraded"
    return {
        "status": status,
        "db": "ok" if db_ok else "error",
        "uptime_seconds": uptime_seconds,
        "version": "1.0.0",
    }
