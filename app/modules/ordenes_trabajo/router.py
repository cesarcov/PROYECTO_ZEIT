from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.security.dependencies import get_current_user
from app.modules.ordenes_trabajo.schemas import (
    OTCreate, OTUpdate, OTStatusUpdate,
    ChecklistItemCreate, ChecklistItemToggle,
    MaterialOTCreate, MaterialOTUpdate,
    TiempoIniciarPayload, TiempoPausarPayload,
    GenerarOCPayload,
)
from app.modules.ordenes_trabajo.service import (
    list_ot_service,
    create_ot_service,
    get_ot_service,
    update_ot_service,
    change_status_service,
    add_checklist_item_service,
    toggle_checklist_service,
    delete_checklist_item_service,
    add_material_service,
    update_material_service,
    delete_material_service,
    iniciar_tiempo_service,
    pausar_tiempo_service,
    cerrar_ot_service,
    get_comparativa_service,
    export_ot_excel_service,
    generar_oc_service,
)

router = APIRouter(prefix="/ot", tags=["Órdenes de Trabajo"])


# ── Lista y detalle ───────────────────────────────────────────────────────────

@router.get("")
def list_ot(
    status:     Optional[str] = Query(None),
    plan_id:    Optional[str] = Query(None),
    tipo:       Optional[str] = Query(None),
    asignado_a: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    return list_ot_service(status=status, plan_id=plan_id, tipo=tipo, asignado_a=asignado_a)


@router.post("")
def create_ot(payload: OTCreate, current_user=Depends(get_current_user)):
    return create_ot_service(payload, current_user)


@router.get("/export")
def export_ot_excel(
    status: Optional[str] = Query(None),
    tipo:   Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    return export_ot_excel_service(status=status, tipo=tipo)


@router.get("/{ot_id}")
def get_ot(ot_id: str, current_user=Depends(get_current_user)):
    return get_ot_service(ot_id)


@router.patch("/{ot_id}")
def update_ot(ot_id: str, payload: OTUpdate, current_user=Depends(get_current_user)):
    return update_ot_service(ot_id, payload, current_user)


@router.patch("/{ot_id}/status")
def change_status(ot_id: str, payload: OTStatusUpdate, current_user=Depends(get_current_user)):
    return change_status_service(ot_id, payload, current_user)


# ── Checklist ─────────────────────────────────────────────────────────────────

@router.post("/{ot_id}/checklist")
def add_checklist(ot_id: str, payload: ChecklistItemCreate, current_user=Depends(get_current_user)):
    return add_checklist_item_service(ot_id, payload)


@router.patch("/{ot_id}/checklist/{item_id}")
def toggle_checklist(ot_id: str, item_id: str, payload: ChecklistItemToggle, current_user=Depends(get_current_user)):
    return toggle_checklist_service(ot_id, item_id, payload, current_user)


@router.delete("/{ot_id}/checklist/{item_id}")
def delete_checklist(ot_id: str, item_id: str, current_user=Depends(get_current_user)):
    return delete_checklist_item_service(ot_id, item_id)


# ── Materiales ────────────────────────────────────────────────────────────────

@router.post("/{ot_id}/materiales")
def add_material(ot_id: str, payload: MaterialOTCreate, current_user=Depends(get_current_user)):
    return add_material_service(ot_id, payload, current_user)


@router.patch("/{ot_id}/materiales/{mat_id}")
def update_material(ot_id: str, mat_id: str, payload: MaterialOTUpdate, current_user=Depends(get_current_user)):
    return update_material_service(ot_id, mat_id, payload, current_user)


@router.delete("/{ot_id}/materiales/{mat_id}")
def delete_material(ot_id: str, mat_id: str, current_user=Depends(get_current_user)):
    return delete_material_service(ot_id, mat_id)


# ── Cronómetro ────────────────────────────────────────────────────────────────

@router.post("/{ot_id}/tiempo/iniciar")
def iniciar_tiempo(ot_id: str, payload: TiempoIniciarPayload = TiempoIniciarPayload(), current_user=Depends(get_current_user)):
    return iniciar_tiempo_service(ot_id, current_user)


@router.post("/{ot_id}/tiempo/pausar")
def pausar_tiempo(ot_id: str, payload: TiempoPausarPayload = TiempoPausarPayload(), current_user=Depends(get_current_user)):
    return pausar_tiempo_service(ot_id, current_user, payload.notas)


# ── Cierre ────────────────────────────────────────────────────────────────────

@router.post("/{ot_id}/cerrar")
def cerrar_ot(ot_id: str, current_user=Depends(get_current_user)):
    return cerrar_ot_service(ot_id, current_user)


# ── Comparativa Plan vs Real ──────────────────────────────────────────────────

@router.get("/{ot_id}/comparativa")
def get_comparativa(ot_id: str, current_user=Depends(get_current_user)):
    return get_comparativa_service(ot_id)


# ── Generar OC desde OT (Fase 5A) ────────────────────────────────────────────

@router.post("/{ot_id}/generar-oc")
def generar_oc(ot_id: str, payload: GenerarOCPayload, current_user=Depends(get_current_user)):
    return generar_oc_service(ot_id, payload, current_user)
