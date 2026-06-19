from fastapi import APIRouter, Depends, Query
from app.core.security.dependencies import get_current_user
from app.modules.clientes.schemas import ClienteCreate, ClienteUpdate, ContactoCreate
from app.modules.clientes.service import (
    list_clientes_service,
    create_cliente_service,
    update_cliente_service,
    get_cliente_cotizaciones_service,
    get_cliente_stats_service,
    create_contacto_service,
    delete_contacto_service,
)

router = APIRouter(prefix="/clientes", tags=["Clientes"])


@router.get("")
def list_clientes(
    solo_activos: bool = Query(False),
    current_user=Depends(get_current_user),
):
    return list_clientes_service(solo_activos)


@router.post("")
def create_cliente(payload: ClienteCreate, current_user=Depends(get_current_user)):
    return create_cliente_service(payload)


@router.patch("/{cliente_id}")
def update_cliente(
    cliente_id: str,
    payload: ClienteUpdate,
    current_user=Depends(get_current_user),
):
    return update_cliente_service(cliente_id, payload)


@router.get("/{cliente_id}/stats")
def get_cliente_stats(
    cliente_id: str,
    current_user=Depends(get_current_user),
):
    return get_cliente_stats_service(cliente_id)


@router.get("/{cliente_id}/cotizaciones")
def get_cliente_cotizaciones(
    cliente_id: str,
    current_user=Depends(get_current_user),
):
    return get_cliente_cotizaciones_service(cliente_id)


@router.post("/{cliente_id}/contactos")
def create_contacto(
    cliente_id: str,
    payload: ContactoCreate,
    current_user=Depends(get_current_user)
):
    return create_contacto_service(cliente_id, payload)


@router.delete("/contactos/{contacto_id}")
def delete_contacto(
    contacto_id: str,
    current_user=Depends(get_current_user)
):
    return delete_contacto_service(contacto_id)
