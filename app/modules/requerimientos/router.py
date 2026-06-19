from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Optional, List
from app.core.security.dependencies import get_current_user
from .schemas import RequerimientoCreate, RequerimientoUpdate, BulkCostosPayload
from . import service

router = APIRouter(prefix="/requerimientos", tags=["Requerimientos de Servicios"])

@router.get("")
def list_requerimientos(
    cliente_id: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    return service.list_requerimientos_service(cliente_id, estado)

@router.post("")
def create_requerimiento(
    payload: RequerimientoCreate,
    current_user=Depends(get_current_user),
):
    return service.create_requerimiento_service(payload)

@router.get("/kpis")
def get_requerimientos_kpis(
    current_user=Depends(get_current_user),
):
    return service.get_requerimientos_kpis_service()

@router.get("/{req_id}/costos")
def list_costos(
    req_id: str,
    current_user=Depends(get_current_user),
):
    return service.list_costos_service(req_id)

@router.post("/{req_id}/costos/bulk")
def bulk_save_costos(
    req_id: str,
    payload: BulkCostosPayload,
    current_user=Depends(get_current_user),
):
    return service.bulk_save_costos_service(req_id, payload)

@router.patch("/{req_id}")
def update_requerimiento(
    req_id: str,
    payload: RequerimientoUpdate,
    current_user=Depends(get_current_user),
):
    updated = service.update_requerimiento_service(req_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Requerimiento de servicio no encontrado")
    return updated

@router.delete("/{req_id}")
def delete_requerimiento(
    req_id: str,
    current_user=Depends(get_current_user),
):
    deleted = service.delete_requerimiento_service(req_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Requerimiento de servicio no encontrado")
    return {"message": "Requerimiento eliminado exitosamente"}
