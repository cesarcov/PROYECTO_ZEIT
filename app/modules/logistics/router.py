from fastapi import APIRouter, Query, UploadFile, File, Depends
from pydantic import BaseModel
from app.core.security.dependencies import get_current_user
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
    MaterialUpdate,
    WarehouseCreate,
    ProjectCreate,
    StockReceptionCreate,
    DispatchItemCreate,
    DispatchCreate,
    DispatchStatusUpdate,
    DispatchConfirmReceipt,
    MaterialValidate,
    ProponerMaterialCreate,
    SubmissionItemReview,
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
    get_tool_maintenance_alerts,
    create_material_service,
    get_materials_service,
    update_material_service,
    delete_material_service,
    import_materials_from_excel,
    import_stock_in_from_excel,
    import_stock_out_from_excel,
    reset_logistics_data_service,
    create_warehouse_service,
    get_warehouses_service,
    update_warehouse_service,
    delete_warehouse_service,
    get_stock_availability_service,
    update_stock_location_meta_service,
    get_warehouse_inventory_service,
    get_calibration_alerts,
    get_all_calibrations_list,
    get_calibration_history,
    add_calibration_record,
    set_material_calibration_flag,
    get_purchase_items,
    add_purchase_item,
    bulk_add_purchase_items,
    update_purchase_item_status,
    delete_purchase_item,
    get_project_requirements_gap,
    create_project_service,
    get_projects_service,
    get_project_summary_service,
    update_project_service,
    delete_project_service,
    import_warehouses_from_excel,
    import_projects_from_excel,
    receive_stock_service,
    add_dispatch_item_service,
    list_dispatches_service,
    create_dispatch_service,
    update_dispatch_status_service,
    confirm_dispatch_receipt_service,
    export_materials_excel_service,
    export_stock_excel_service,
    list_pending_materials_service,
    count_pending_materials_service,
    validate_material_service,
    proponer_material_service,
    list_project_submissions_service,
    get_submission_detail_service,
    review_submission_item_service,
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
# 📋 LISTAR MATERIALES (con filtro ?estado=)
# ============================================================
@router.get("/materials", dependencies=[Depends(get_current_user)])
def get_materials(estado: str = Query(None)):
    return get_materials_service(estado=estado)


# ============================================================
# 🔍 MATERIALES PENDIENTES DE VALIDACIÓN
# ============================================================
@router.get(
    "/materials/pending",
    dependencies=[Depends(require_permission("logistics:materials:validate"))]
)
def get_pending_materials():
    return list_pending_materials_service()


# ============================================================
# 🔢 CONTADOR DE MATERIALES PENDIENTES (para badge sidebar)
# ============================================================
@router.get("/materials/pending-count", dependencies=[Depends(get_current_user)])
def get_pending_materials_count():
    return count_pending_materials_service()


# ============================================================
# 💡 PROPONER MATERIAL NUEVO (desde APU / Operaciones)
# ============================================================
@router.post(
    "/materials/proponer",
    dependencies=[Depends(get_current_user)]
)
def proponer_material(
    payload: ProponerMaterialCreate,
    current_user=Depends(get_current_user)
):
    return proponer_material_service(payload, current_user)


# ============================================================
# ✅ VALIDAR MATERIAL PROPUESTO
# ============================================================
@router.patch(
    "/materials/{material_id}/validate",
    dependencies=[Depends(require_permission("logistics:materials:validate"))]
)
def validate_material(
    material_id: str,
    payload: MaterialValidate,
    current_user=Depends(get_current_user)
):
    return validate_material_service(material_id, payload, current_user)


# ============================================================
# 📋 REQUERIMIENTOS DE PROYECTO (submissions)
# ============================================================
@router.get(
    "/project-submissions",
    dependencies=[Depends(require_permission("logistics:plan_submissions:view"))]
)
def list_project_submissions():
    return list_project_submissions_service()


@router.get(
    "/project-submissions/{submission_id}",
    dependencies=[Depends(require_permission("logistics:plan_submissions:view"))]
)
def get_submission_detail(submission_id: str):
    return get_submission_detail_service(submission_id)


@router.patch(
    "/project-submissions/{submission_id}/items/{item_id}",
    dependencies=[Depends(require_permission("logistics:plan_submissions:review"))]
)
def review_submission_item(
    submission_id: str,
    item_id: str,
    payload: SubmissionItemReview,
    current_user=Depends(get_current_user)
):
    return review_submission_item_service(submission_id, item_id, payload, current_user)


# ============================================================
# ✏️ EDITAR MATERIAL
# ============================================================
@router.put(
    "/materials/{material_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def update_material(material_id: str, payload: MaterialUpdate):
    return update_material_service(material_id, payload)


# ============================================================
# 🗑️ ELIMINAR MATERIAL
# ============================================================
@router.delete(
    "/materials/{material_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def delete_material(material_id: str):
    return delete_material_service(material_id)


# ============================================================
# ❤️ HEALTH
# ============================================================
@router.get("/health", dependencies=[Depends(get_current_user)])
def logistics_health():
    return {"status": "Logistics module OK"}


# ============================================================
# ➕ CREAR MOVIMIENTO DE STOCK
# ============================================================
@router.post(
    "/stock-movements/",
    response_model=StockMovementResponse
)
def create_stock_movement(
    payload: StockMovementCreate,
    current_user=Depends(get_current_user),
    _=Depends(require_permission("logistics:stock:move")),
):
    return create_stock_movement_service(payload, current_user)


# ============================================================
# 📦 CONSULTAR STOCK ACTUAL (KARDEX)
# ============================================================
@router.get("/stock")
def get_stock(
    material_id: str = Query(...),
    warehouse_id: str = Query(...),
    project_id: str | None = Query(None),
    _=Depends(get_current_user),
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
    _=Depends(get_current_user),
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
def stock_summary(material_id: str | None = None, _=Depends(get_current_user)):
    """
    Devuelve el stock actual agrupado por:
    material → warehouse → cantidad
    """
    return get_current_stock_summary(material_id)


# ============================================================
# 🚨 ALERTAS DE STOCK NEGATIVO
# ============================================================
@router.get("/stock/alerts/negative", dependencies=[Depends(get_current_user)])
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
    response_model=StockLocationResponse,
    dependencies=[Depends(get_current_user)],
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
    _=Depends(get_current_user),
):
    return get_material_locations(
        material_id=material_id,
        warehouse_id=warehouse_id
    )

@router.get("/stock/by-project", dependencies=[Depends(get_current_user)])
def stock_by_project(project_id: str | None = None):
    return get_stock_by_project(project_id)

@router.get("/stock/alerts/low", dependencies=[Depends(get_current_user)])
def low_stock_alerts():
    return get_low_stock_alerts()

@router.get("/stock/most-used", dependencies=[Depends(get_current_user)])
def most_used_materials(limit: int = 10):
    return get_most_used_materials(limit)

# ➕ Asignar herramienta
@router.post("/tools/assign", dependencies=[Depends(get_current_user)])
def assign_tool(payload: ToolAssignCreate):
    return assign_tool_service(payload)

# 🔁 Devolver herramienta
@router.post("/tools/return", dependencies=[Depends(get_current_user)])
def return_tool(payload: ToolReturnRequest):
    return return_tool_service(str(payload.assignment_id))

# 📋 Ver herramientas asignadas
@router.get("/tools/assigned", dependencies=[Depends(get_current_user)])
def get_assigned_tools():
    return get_assigned_tools_service()

@router.post("/tools/maintenance", dependencies=[Depends(get_current_user)])
def create_maintenance(payload: ToolMaintenanceCreate):
    return register_tool_maintenance(
        payload.material_id,
        payload.maintenance_type,
        payload.last_maintenance,
        payload.next_due,
        payload.notes
    )

@router.get("/tools/maintenance/alerts", dependencies=[Depends(get_current_user)])
def maintenance_alerts(days: int = 7):
    return get_tool_maintenance_alerts(days)

@router.get("/stock/ranking", dependencies=[Depends(get_current_user)])
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


@router.get("/warehouses", dependencies=[Depends(get_current_user)])
def get_warehouses():
    return get_warehouses_service()


@router.get("/warehouses/{warehouse_id}/inventory", dependencies=[Depends(get_current_user)])
def get_warehouse_inventory(warehouse_id: str):
    """Inventario completo de un almacén: stock, ubicación, condición, último movimiento."""
    try:
        return get_warehouse_inventory_service(warehouse_id)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/warehouses/{warehouse_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def update_warehouse(warehouse_id: str, payload: WarehouseCreate):
    return update_warehouse_service(warehouse_id, payload)


@router.delete(
    "/warehouses/{warehouse_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def delete_warehouse(warehouse_id: str):
    return delete_warehouse_service(warehouse_id)


@router.get("/stock/availability", dependencies=[Depends(get_current_user)])
def stock_availability():
    """
    Flat list: material + warehouse + stock disponible + ubicación física.
    """
    return get_stock_availability_service()


class StockLocationMetaUpdate(BaseModel):
    material_id: str
    warehouse_id: str
    rack: str
    level: str
    box: str
    position: str = ""


@router.put("/stock/location-meta", dependencies=[Depends(get_current_user)])
def update_stock_location_meta(payload: StockLocationMetaUpdate):
    """Actualiza la codificación física (rack/nivel/casillero) sin alterar el stock."""
    return update_stock_location_meta_service(
        payload.material_id,
        payload.warehouse_id,
        payload.rack,
        payload.level,
        payload.box,
        payload.position,
    )

# ============================================================
# 🏗 PROJECTS
# ============================================================

@router.post(
    "/projects",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def create_project(payload: ProjectCreate):
    return create_project_service(payload)


@router.get("/projects", dependencies=[Depends(get_current_user)])
def get_projects():
    return get_projects_service()


@router.get("/projects/{project_id}/summary")
def get_project_summary(project_id: str, _=Depends(get_current_user)):
    try:
        return get_project_summary_service(project_id)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))


@router.put(
    "/projects/{project_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def update_project(project_id: str, payload: ProjectCreate):
    return update_project_service(project_id, payload)


@router.delete(
    "/projects/{project_id}",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def delete_project(project_id: str):
    return delete_project_service(project_id)


# ============================================================
# 📥 IMPORTACIONES MASIVAS
# ============================================================

@router.post(
    "/warehouses/import",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def import_warehouses(file: UploadFile = File(...)):
    return import_warehouses_from_excel(file.file)

@router.post(
    "/projects/import",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def import_projects(file: UploadFile = File(...)):
    return import_projects_from_excel(file.file)

@router.post(
    "/stock-movements/receive",
    dependencies=[Depends(require_permission("logistics:stock:receive"))]
)
def receive_stock(
    payload: StockReceptionCreate,
    current_user=Depends(get_current_user)
):
    return receive_stock_service(payload, current_user)

# ============================================================
# 🚚 DISPATCHES — FLUJO COMPLETO
# ============================================================

@router.get(
    "/dispatches",
    dependencies=[Depends(require_permission("logistics:dispatch:manage"))]
)
def list_dispatches():
    return list_dispatches_service()


@router.post(
    "/dispatches",
    dependencies=[Depends(require_permission("logistics:dispatch:create"))]
)
def create_dispatch(
    payload: DispatchCreate,
    current_user: dict = Depends(get_current_user)
):
    return create_dispatch_service(payload, current_user)


@router.patch(
    "/dispatches/{dispatch_id}/status",
    dependencies=[Depends(require_permission("logistics:dispatch:manage"))]
)
def update_dispatch_status(
    dispatch_id: str,
    payload: DispatchStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    return update_dispatch_status_service(dispatch_id, payload.status, current_user)


@router.post("/dispatches/{dispatch_id}/confirm")
def confirm_dispatch(
    dispatch_id: str,
    payload: DispatchConfirmReceipt,
    current_user: dict = Depends(get_current_user)
):
    return confirm_dispatch_receipt_service(dispatch_id, current_user, payload.receipt_notes)


@router.post("/dispatches/{dispatch_id}/items")
def add_dispatch_item(
    dispatch_id: str,
    payload: DispatchItemCreate,
    current_user: dict = Depends(get_current_user)
):
    return add_dispatch_item_service(dispatch_id, payload, current_user)


# ============================================================
# CALIBRATION ENDPOINTS
# ============================================================

@router.get("/calibrations/alerts", dependencies=[Depends(get_current_user)])
def calibration_alerts():
    """Materials with calibration expiring within 30 days or no record."""
    return get_calibration_alerts()


@router.get("/calibrations/list", dependencies=[Depends(get_current_user)])
def calibrations_all():
    """All calibration-required materials with latest status."""
    return get_all_calibrations_list()


@router.get("/calibrations/history/{material_id}", dependencies=[Depends(get_current_user)])
def calibration_history(material_id: str):
    return get_calibration_history(material_id)


@router.post("/calibrations", dependencies=[Depends(get_current_user)])
def create_calibration_record(payload: dict, current_user: dict = Depends(get_current_user)):
    return add_calibration_record(payload, str(current_user["id"]))


@router.patch("/calibrations/flag/{material_id}", dependencies=[Depends(get_current_user)])
def set_calibration_flag(material_id: str, payload: dict):
    return set_material_calibration_flag(
        material_id,
        payload.get("required", True),
        payload.get("interval_days"),
    )


# ============================================================
# PURCHASE ITEMS ENDPOINTS
# ============================================================

@router.get("/purchases", dependencies=[Depends(get_current_user)])
def list_purchases(project_id: str = None, status: str = None):
    return get_purchase_items(project_id, status)


@router.post("/purchases", dependencies=[Depends(get_current_user)])
def create_purchase_item(payload: dict, current_user: dict = Depends(get_current_user)):
    return add_purchase_item(payload, str(current_user["id"]))


@router.post("/purchases/bulk", dependencies=[Depends(get_current_user)])
def bulk_create_purchase_items(payload: dict, current_user: dict = Depends(get_current_user)):
    items = payload.get("items", [])
    return bulk_add_purchase_items(items, str(current_user["id"]))


@router.patch("/purchases/{item_id}/status", dependencies=[Depends(get_current_user)])
def patch_purchase_status(item_id: str, payload: dict):
    return update_purchase_item_status(
        item_id,
        payload.get("status"),
        payload.get("notes"),
    )


@router.delete("/purchases/{item_id}", dependencies=[Depends(get_current_user)])
def remove_purchase_item(item_id: str):
    return delete_purchase_item(item_id)


# ============================================================
# REQUIREMENTS GAP ENDPOINT
# ============================================================

@router.get("/projects/{project_id}/requirements-gap", dependencies=[Depends(get_current_user)])
def project_requirements_gap(project_id: str):
    """Gap analysis: what operations requested vs what logistics has in stock."""
    try:
        return get_project_requirements_gap(project_id)
    except ValueError as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=str(e))


# ============================================================
# 📥 EXPORTAR MATERIALES / STOCK A EXCEL
# ============================================================

@router.get("/materials/export", dependencies=[Depends(get_current_user)])
def export_materials_excel():
    """Descarga el catálogo completo de materiales como Excel."""
    return export_materials_excel_service()


@router.get("/stock/export", dependencies=[Depends(get_current_user)])
def export_stock_excel():
    """Descarga el reporte de stock actual por almacén como Excel."""
    return export_stock_excel_service()
