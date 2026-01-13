from fastapi import (
    APIRouter, 
    Query, 
    UploadFile, 
    File, 
    Depends, 
    HTTPException
    )
from app.core.security.dependencies import get_current_user
from app.core.security.permissions import require_permission
from fastapi.security import OAuth2PasswordRequestForm
from app.core.security.hashing import verify_password
from app.core.security.auth import create_access_token, get_user_permissions
from app.core.database import db_connection
from app.core.security.permissions import require_permission
from app.modules.logistics.schemas import (
    StockMovementCreate,
    StockMovementResponse,
    StockLocationCreate,
    StockLocationResponse,
    ToolAssignCreate,
    ToolReturnRequest,
    ToolMaintenanceCreate,
    MaterialCreate,
    WarehouseCreate,
    ProjectCreate
)
from app.modules.logistics.service import (
    create_stock_movement_service,
    get_stock_movements_history,
    get_current_stock,
    get_current_stock_summary,
    get_negative_stock,
    upsert_stock_location,
    get_material_locations,
    get_stock_by_project,
    get_low_stock_alerts,
    get_most_used_materials,
    assign_tool_service,
    return_tool_service,
    get_assigned_tools_service,
    register_tool_maintenance,
    get_due_maintenance,
    get_tool_maintenance_alerts,
    create_material_service,
    get_materials_service,
    import_materials_from_excel,
    import_stock_in_from_excel,
    import_stock_out_from_excel,
    reset_logistics_data_service,
    create_warehouse_service, 
    get_warehouses_service,
    create_project_service,
    get_projects_service,
    import_warehouses_from_excel,
    import_projects_from_excel
)

router = APIRouter(
    prefix="/logistics",
    tags=["Logistics"]
)

# ============================================================
# 📦 CREAR MATERIAL
# ============================================================
@router.post(
    "/materials",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def create_material(payload: MaterialCreate):
    return create_material_service(payload)


# ============================================================
# 📋 LISTAR MATERIALES
# ============================================================
@router.get("/materials")
def get_materials():
    return get_materials_service()


# ============================================================
# ❤️ HEALTH
# ============================================================
@router.get("/health")
def logistics_health():
    return {"status": "Logistics module OK"}


# ============================================================
# ➕ CREAR MOVIMIENTO DE STOCK
# ============================================================
@router.post(
    "/stock-movements/",
    response_model=StockMovementResponse,
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def create_stock_movement(
    payload: StockMovementCreate,
    user=Depends(get_current_user)):
    return create_stock_movement_service(payload)

# ============================================================
# 📦 CONSULTAR STOCK ACTUAL (KARDEX)
# ============================================================
@router.get("/stock")
def get_stock(
    material_id: str = Query(...),
    warehouse_id: str = Query(...),
    project_id: str | None = Query(None)
):
    stock = get_current_stock(
        material_id=material_id,
        warehouse_id=warehouse_id,
        project_id=project_id
    )

    return {
        "material_id": material_id,
        "warehouse_id": warehouse_id,
        "project_id": project_id,
        "current_stock": stock
    }


# ============================================================
# 📜 HISTORIAL DE MOVIMIENTOS (AUDITORÍA)
# ============================================================
@router.get("/stock-movements/history")
def stock_history(
    date_from: str = Query(..., description="YYYY-MM-DD"),
    date_to: str = Query(..., description="YYYY-MM-DD"),
    material_id: str | None = None,
    project_id: str | None = None,
    warehouse_id: str | None = None,
    movement_type: str | None = None,
    created_by: str | None = None,
):
    return get_stock_movements_history(
        date_from=date_from,
        date_to=date_to,
        material_id=material_id,
        project_id=project_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type,
        created_by=created_by,
    )


# ============================================================
# 📊 RESUMEN GLOBAL DE STOCK
# ============================================================
@router.get("/stock/summary")
def stock_summary(material_id: str | None = None):
    """
    Devuelve el stock actual agrupado por:
    material → warehouse → cantidad
    """
    return get_current_stock_summary(material_id)


# ============================================================
# 🚨 ALERTAS DE STOCK NEGATIVO
# ============================================================
@router.get("/stock/alerts/negative")
def negative_stock_alerts():
    """
    Detecta inconsistencias de stock (< 0)
    """
    return get_negative_stock()


# ============================================================
# 📍 ASIGNAR / ACTUALIZAR UBICACIÓN
# ============================================================
@router.post(
    "/stock-locations/",
    response_model=StockLocationResponse
)
def assign_stock_location(payload: StockLocationCreate):
    return upsert_stock_location(payload)


# ============================================================
# 📦 VER UBICACIONES DE UN MATERIAL
# ============================================================
@router.get("/stock-locations")
def get_stock_locations(
    material_id: str | None = None,
    warehouse_id: str | None = None,
):
    return get_material_locations(
        material_id=material_id,
        warehouse_id=warehouse_id
    )

@router.get("/stock/by-project")
def stock_by_project(project_id: str | None = None):
    return get_stock_by_project(project_id)

@router.get("/stock/alerts/low")
def low_stock_alerts():
    return get_low_stock_alerts()

@router.get("/stock/most-used")
def most_used_materials(limit: int = 10):
    return get_most_used_materials(limit)

# ➕ Asignar herramienta
@router.post("/tools/assign")
def assign_tool(payload: ToolAssignCreate):
    return assign_tool_service(payload)

# 🔁 Devolver herramienta
@router.post("/tools/return")
def return_tool(payload: ToolReturnRequest):
    return return_tool_service(str(payload.assignment_id))

# 📋 Ver herramientas asignadas
@router.get("/tools/assigned")
def get_assigned_tools():
    return get_assigned_tools_service()

@router.post("/tools/maintenance")
def create_maintenance(payload: ToolMaintenanceCreate):
    return register_tool_maintenance(
        payload.material_id,
        payload.maintenance_type,
        payload.last_maintenance,
        payload.next_due,
        payload.notes
    )
@router.get("/tools/maintenance/alerts")
def maintenance_alerts(days: int = 7):
    return get_tool_maintenance_alerts(days)

@router.get("/stock/ranking")
def ranking_materials(limit: int = 10):
    return get_most_used_materials(limit)
@router.post(
    "/materials/import",
    dependencies=[Depends(require_permission("logistics:import:materials"))]
)
def import_materials(file: UploadFile = File(...)):
    return import_materials_from_excel(file.file)

@router.post(
    "/stock/import-in",
    dependencies=[Depends(require_permission("logistics:import:stock"))]
)
def import_stock_in(file: UploadFile = File(...)):
    return import_stock_in_from_excel(file.file)

@router.post(
    "/stock/import-out",
    dependencies=[Depends(require_permission("logistics:import:stock"))]
)
def import_stock_out(file: UploadFile = File(...)):
    return import_stock_out_from_excel(file.file)

# ============================================================
# 🧹 RESET DE DATOS (SOLO TESTING)
# ============================================================
@router.post(
    "/admin/reset",
    dependencies=[Depends(require_permission("logistics:admin:reset"))]
)
def reset_logistics_data():
    """
    ⚠️ Elimina TODOS los datos del módulo de logística.
    No borra tablas, solo registros.
    Usar SOLO en entornos de prueba.
    """
    return reset_logistics_data_service()

# ============================================================
# 🏬 WAREHOUSES
# ============================================================

@router.post(
    "/warehouses",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def create_warehouse(payload: WarehouseCreate):
    return create_warehouse_service(payload)


@router.get("/warehouses")
def get_warehouses():
    return get_warehouses_service()

# ============================================================
# 🏗 PROJECTS
# ============================================================

@router.post(
    "/projects",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def create_project(payload: ProjectCreate):
    return create_project_service(payload)


@router.get("/projects")
def get_projects():
    return get_projects_service()

# ============================================================
# 📥 IMPORTACIONES MASIVAS
# ============================================================

@router.post("/warehouses/import")
def import_warehouses(file: UploadFile = File(...)):
    return import_warehouses_from_excel(file.file)

@router.post("/projects/import")
def import_projects(file: UploadFile = File(...)):
    return import_projects_from_excel(file.file)


