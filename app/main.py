from fastapi import FastAPI
from app.core.security.router import router as auth_router
from app.modules.logistics.router import router as logistics_router
from app.core.audit.middleware import AuditMiddleware

print(">>> MAIN.PY CORRECTO CARGADO <<<")

app = FastAPI(title="ERP Modular")
app.add_middleware(AuditMiddleware)

app.add_middleware(AuditMiddleware)

# Registrar routers
app.include_router(logistics_router)

# AUTH GLOBAL
app.include_router(auth_router)

@app.get("/")
def root():
    return {"message": "ERP running"}

@app.get("/debug/routes")
def debug_routes():
    return [route.path for route in app.routes]
