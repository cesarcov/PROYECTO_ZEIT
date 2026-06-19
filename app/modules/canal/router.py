from fastapi import APIRouter, Depends
from app.core.security.dependencies import get_current_user
from app.modules.canal.schemas import SolicitudCreate, SolicitudStatusUpdate, MensajeCreate, SolicitudAssign
from app.modules.canal.service import (
    list_solicitudes_service,
    get_solicitud_service,
    create_solicitud_service,
    update_status_service,
    add_mensaje_service,
    count_pending_service,
    assign_solicitud_service,
)

router = APIRouter(prefix="/canal", tags=["Canal"])



@router.get("/solicitudes")
def list_solicitudes(current_user=Depends(get_current_user)):
    return list_solicitudes_service(current_user)


@router.get("/solicitudes/pending-count")
def pending_count(current_user=Depends(get_current_user)):
    return count_pending_service(current_user)


@router.post("/solicitudes")
def create_solicitud(payload: SolicitudCreate, current_user=Depends(get_current_user)):
    return create_solicitud_service(payload, current_user)


@router.get("/solicitudes/{solicitud_id}")
def get_solicitud(solicitud_id: int, current_user=Depends(get_current_user)):
    return get_solicitud_service(solicitud_id, current_user)


@router.patch("/solicitudes/{solicitud_id}/status")
def update_status(solicitud_id: int, payload: SolicitudStatusUpdate, current_user=Depends(get_current_user)):
    return update_status_service(solicitud_id, payload.status, current_user)


@router.post("/solicitudes/{solicitud_id}/mensajes")
def add_mensaje(solicitud_id: int, payload: MensajeCreate, current_user=Depends(get_current_user)):
    return add_mensaje_service(solicitud_id, payload.mensaje, current_user)


@router.patch("/solicitudes/{solicitud_id}/assign")
def assign_solicitud(
    solicitud_id: int,
    payload: SolicitudAssign,
    current_user=Depends(get_current_user),
):
    return assign_solicitud_service(solicitud_id, payload.assigned_to, current_user)

