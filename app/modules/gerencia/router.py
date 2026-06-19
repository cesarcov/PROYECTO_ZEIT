from fastapi import APIRouter, Depends, Query
from app.core.security.dependencies import get_current_user
from app.modules.gerencia.schemas import AprobacionDecidir
from app.modules.gerencia.service import (
    list_aprobaciones_service,
    decidir_aprobacion_service,
)

router = APIRouter(prefix="/gerencia", tags=["Gerencia"])

@router.get("/aprobaciones")
def list_aprobaciones(
    estado: str = Query(None),
    current_user=Depends(get_current_user),
):
    return list_aprobaciones_service(estado=estado)

@router.post("/aprobaciones/{aprobacion_id}/decidir")
def decidir_aprobacion(
    aprobacion_id: str,
    payload: AprobacionDecidir,
    current_user=Depends(get_current_user),
):
    return decidir_aprobacion_service(aprobacion_id, payload, current_user)
