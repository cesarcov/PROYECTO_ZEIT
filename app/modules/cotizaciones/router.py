from fastapi import APIRouter, Depends, Query, UploadFile, File
from app.core.security.dependencies import get_current_user
from app.modules.cotizaciones.schemas import (
    RecursoMOCreate, RecursoMOUpdate,
    PartidaCreate, PartidaUpdate,
    APUItemCreate, APUItemUpdate,
    APUBulkCreate,
    PresupuestoConfigUpdate,
    CotizacionStatusUpdate,
    BaulCreate, BaulUpdate,
    BaulItemCreate, BaulItemUpdate,
    TarifaPersonalCreate, TarifaPersonalUpdate,
    CategoriaCostoCreate, CategoriaCostoUpdate,
)
from app.modules.cotizaciones.service import (
    list_recursos_mo_service,
    create_recurso_mo_service,
    update_recurso_mo_service,
    delete_recurso_mo_service,
    list_partidas_service,
    create_partida_service,
    update_partida_service,
    delete_partida_service,
    list_apu_service,
    create_apu_item_service,
    update_apu_item_service,
    delete_apu_item_service,
    bulk_create_apu_service,
    get_config_service,
    update_config_service,
    get_resumen_service,
    export_pdf_service,
    export_excel_service,
    update_cotizacion_status_service,
    list_cotizaciones_service,
    get_cotizaciones_stats_service,
    list_baules_service,
    create_baul_service,
    update_baul_service,
    delete_baul_service,
    add_baul_item_service,
    update_baul_item_service,
    delete_baul_item_service,
    import_baules_from_excel_service,
    list_tarifas_personal_service,
    create_tarifa_personal_service,
    update_tarifa_personal_service,
    delete_tarifa_personal_service,
    buscar_tarifa_personal_service,
    list_roles_tarifas_service,
    list_categorias_costo_service,
    create_categoria_costo_service,
    update_categoria_costo_service,
)

router = APIRouter(prefix="/cotizaciones", tags=["Cotizaciones"])


# ── Lista global de cotizaciones ──────────────────────────────────────────────

@router.get("")
def list_cotizaciones(
    status: str = Query(None),
    cliente_id: str = Query(None),
    current_user=Depends(get_current_user),
):
    return list_cotizaciones_service(status, cliente_id)


@router.get("/stats")
def get_cotizaciones_stats(current_user=Depends(get_current_user)):
    return get_cotizaciones_stats_service()


# ── Recursos de Mano de Obra ──────────────────────────────────────────────────

@router.get("/recursos-mo")
def list_recursos_mo(current_user=Depends(get_current_user)):
    return list_recursos_mo_service()


@router.post("/recursos-mo")
def create_recurso_mo(payload: RecursoMOCreate, current_user=Depends(get_current_user)):
    return create_recurso_mo_service(payload)


@router.patch("/recursos-mo/{recurso_id}")
def update_recurso_mo(recurso_id: str, payload: RecursoMOUpdate, current_user=Depends(get_current_user)):
    return update_recurso_mo_service(recurso_id, payload)


@router.delete("/recursos-mo/{recurso_id}")
def delete_recurso_mo(recurso_id: str, current_user=Depends(get_current_user)):
    return delete_recurso_mo_service(recurso_id)


# ── Partidas del presupuesto ──────────────────────────────────────────────────

@router.get("/planes/{plan_id}/partidas")
def list_partidas(plan_id: str, current_user=Depends(get_current_user)):
    return list_partidas_service(plan_id)


@router.post("/planes/{plan_id}/partidas")
def create_partida(plan_id: str, payload: PartidaCreate, current_user=Depends(get_current_user)):
    return create_partida_service(plan_id, payload)


@router.patch("/planes/{plan_id}/partidas/{partida_id}")
def update_partida(plan_id: str, partida_id: str, payload: PartidaUpdate, current_user=Depends(get_current_user)):
    return update_partida_service(plan_id, partida_id, payload)


@router.delete("/planes/{plan_id}/partidas/{partida_id}")
def delete_partida(plan_id: str, partida_id: str, current_user=Depends(get_current_user)):
    return delete_partida_service(plan_id, partida_id)


# ── Ítems APU ─────────────────────────────────────────────────────────────────

@router.get("/partidas/{partida_id}/apu")
def list_apu(partida_id: str, current_user=Depends(get_current_user)):
    return list_apu_service(partida_id)


@router.post("/partidas/{partida_id}/apu")
def create_apu_item(partida_id: str, payload: APUItemCreate, current_user=Depends(get_current_user)):
    return create_apu_item_service(partida_id, payload)


@router.patch("/partidas/{partida_id}/apu/{apu_id}")
def update_apu_item(partida_id: str, apu_id: str, payload: APUItemUpdate, current_user=Depends(get_current_user)):
    return update_apu_item_service(partida_id, apu_id, payload)


@router.delete("/partidas/{partida_id}/apu/{apu_id}")
def delete_apu_item(partida_id: str, apu_id: str, current_user=Depends(get_current_user)):
    return delete_apu_item_service(partida_id, apu_id)


# ── Configuración y resumen ───────────────────────────────────────────────────

@router.get("/planes/{plan_id}/config")
def get_config(plan_id: str, current_user=Depends(get_current_user)):
    return get_config_service(plan_id)


@router.put("/planes/{plan_id}/config")
def update_config(plan_id: str, payload: PresupuestoConfigUpdate, current_user=Depends(get_current_user)):
    return update_config_service(plan_id, payload)


@router.get("/planes/{plan_id}/resumen")
def get_resumen(plan_id: str, current_user=Depends(get_current_user)):
    return get_resumen_service(plan_id)


# ── Ciclo de estados ──────────────────────────────────────────────────────────

@router.patch("/planes/{plan_id}/config/status")
def update_cotizacion_status(
    plan_id: str,
    payload: CotizacionStatusUpdate,
    current_user=Depends(get_current_user),
):
    return update_cotizacion_status_service(plan_id, payload.status)


# ── Exportación ───────────────────────────────────────────────────────────────

@router.get("/planes/{plan_id}/export/pdf")
def export_pdf(plan_id: str, current_user=Depends(get_current_user)):
    return export_pdf_service(plan_id)


@router.get("/planes/{plan_id}/export/excel")
def export_excel(plan_id: str, current_user=Depends(get_current_user)):
    return export_excel_service(plan_id)


# ── APU Bulk ──────────────────────────────────────────────────────────────────

@router.post("/partidas/{partida_id}/apu/bulk")
def bulk_create_apu(partida_id: str, payload: APUBulkCreate, current_user=Depends(get_current_user)):
    return bulk_create_apu_service(partida_id, payload.items)


# ── Baúles APU ────────────────────────────────────────────────────────────────

@router.get("/baules")
def list_baules(current_user=Depends(get_current_user)):
    return list_baules_service()

@router.post("/baules")
def create_baul(payload: BaulCreate, current_user=Depends(get_current_user)):
    return create_baul_service(payload)

@router.post("/baules/import")
def import_baules(file: UploadFile = File(...), current_user=Depends(get_current_user)):
    return import_baules_from_excel_service(file.file)

@router.patch("/baules/{baul_id}")
def update_baul(baul_id: str, payload: BaulUpdate, current_user=Depends(get_current_user)):
    return update_baul_service(baul_id, payload)

@router.delete("/baules/{baul_id}")
def delete_baul(baul_id: str, current_user=Depends(get_current_user)):
    return delete_baul_service(baul_id)

@router.post("/baules/{baul_id}/items")
def add_baul_item(baul_id: str, payload: BaulItemCreate, current_user=Depends(get_current_user)):
    return add_baul_item_service(baul_id, payload)

@router.patch("/baules/{baul_id}/items/{item_id}")
def update_baul_item(baul_id: str, item_id: str, payload: BaulItemUpdate, current_user=Depends(get_current_user)):
    return update_baul_item_service(baul_id, item_id, payload)

@router.delete("/baules/{baul_id}/items/{item_id}")
def delete_baul_item(baul_id: str, item_id: str, current_user=Depends(get_current_user)):
    return delete_baul_item_service(baul_id, item_id)


# ── Tarifas de Personal (Matriz contextual) ───────────────────────────────────
# IMPORTANTE: /buscar y /roles van ANTES de /{id} para que FastAPI no los capture

@router.get("/tarifas-personal/roles")
def list_roles_tarifas(current_user=Depends(get_current_user)):
    return list_roles_tarifas_service()


@router.get("/tarifas-personal/buscar")
def buscar_tarifa_personal(
    rol: str = Query(...),
    contexto: str = Query(...),
    ubicacion: str = Query(...),
    modalidad: str = Query(...),
    current_user=Depends(get_current_user),
):
    resultado = buscar_tarifa_personal_service(rol, contexto, ubicacion, modalidad)
    return resultado  # puede ser None → 200 con null


@router.get("/tarifas-personal")
def list_tarifas_personal(
    rol: str = Query(None),
    contexto: str = Query(None),
    ubicacion: str = Query(None),
    modalidad: str = Query(None),
    activo: bool = Query(True),
    current_user=Depends(get_current_user),
):
    return list_tarifas_personal_service(rol, contexto, ubicacion, modalidad, activo)


@router.post("/tarifas-personal")
def create_tarifa_personal(payload: TarifaPersonalCreate, current_user=Depends(get_current_user)):
    return create_tarifa_personal_service(payload)


@router.patch("/tarifas-personal/{tarifa_id}")
def update_tarifa_personal(tarifa_id: str, payload: TarifaPersonalUpdate, current_user=Depends(get_current_user)):
    return update_tarifa_personal_service(tarifa_id, payload)


@router.delete("/tarifas-personal/{tarifa_id}")
def delete_tarifa_personal(tarifa_id: str, current_user=Depends(get_current_user)):
    return delete_tarifa_personal_service(tarifa_id)


# ── Categorías de Costo ───────────────────────────────────────────────────────

@router.get("/categorias-costo")
def list_categorias_costo(
    solo_activas: bool = Query(True),
    current_user=Depends(get_current_user),
):
    return list_categorias_costo_service(solo_activas)


@router.post("/categorias-costo")
def create_categoria_costo(payload: CategoriaCostoCreate, current_user=Depends(get_current_user)):
    return create_categoria_costo_service(payload)


@router.patch("/categorias-costo/{categoria_id}")
def update_categoria_costo(categoria_id: str, payload: CategoriaCostoUpdate, current_user=Depends(get_current_user)):
    return update_categoria_costo_service(categoria_id, payload)
