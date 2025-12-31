from fastapi import FastAPI
from app.modules.logistics.router import router as logistics_router

print(">>> MAIN.PY CORRECTO CARGADO <<<")

app = FastAPI(title="ERP Modular")

# Registrar routers
app.include_router(logistics_router)

@app.get("/")
def root():
    return {"message": "ERP running"}

@app.get("/debug/routes")
def debug_routes():
    return [route.path for route in app.routes]
