import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from app.core.database import db_connection

logger = logging.getLogger(__name__)

app = FastAPI(title="ERP Modular")


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

# ===============================
# CORS (FRONTEND)
# ===============================
origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
]

# Orden importante: el último add_middleware es el primero en ejecutarse.
# AuditMiddleware primero → CORS outermost (maneja preflight antes que auditoría)
app.add_middleware(AuditMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
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


@app.get("/")
def root():
    return {"message": "ERP running"}
