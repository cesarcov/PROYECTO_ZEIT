from fastapi import APIRouter, Depends
from app.core.security.permissions import require_permission
from app.modules.requests.schemas import (
    ReservationCreate,
    MaterialRequestCreate,
)
from app.modules.requests.service import (
    create_reservation_service,
    list_my_reservations_service,
    list_all_reservations_service,
    confirm_reservation_service,
    create_material_request_service,
    list_my_material_requests_service,
    list_all_material_requests_service,
    approve_material_request_service,
    reject_material_request_service,
    expire_reservations_service,
    list_operational_material_requests_service,
    release_reservation_service,
    list_my_dispatches_service,
    get_request_history_service,
)
from app.core.security.dependencies import get_current_user

router = APIRouter(
    prefix="/requests",
    tags=["Requests"]
)

# =====================================================
# 📦 RESERVAS DE STOCK
# =====================================================

@router.post(
    "/reservations",
    dependencies=[Depends(require_permission("logistics:stock:view"))]
)
def create_reservation(
    payload: ReservationCreate,
    current_user=Depends(get_current_user)
):
    """
    Crear una reserva de stock (NO mueve stock físico).
    """
    return create_reservation_service(payload, current_user)


@router.get("/reservations/my")
def my_reservations(current_user=Depends(get_current_user)):
    return list_my_reservations_service(current_user)


@router.get(
    "/reservations",
    dependencies=[Depends(require_permission("logistics:stock:view"))]
)
def list_all_reservations():
    return list_all_reservations_service()


@router.post(
    "/reservations/{reservation_id}/confirm",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def confirm_reservation(
    reservation_id: str,
    current_user=Depends(get_current_user)
):
    """
    Confirmar reserva → crea movimiento TRANSFER (IN_TRANSIT).
    """
    return confirm_reservation_service(reservation_id, current_user)


@router.post(
    "/reservations/expire",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def expire_reservations():
    """
    Expira automáticamente reservas vencidas.
    """
    return expire_reservations_service()


# =====================================================
# 🧾 SOLICITUDES DE MATERIAL
# =====================================================

@router.post("/material-requests")
def create_material_request(
    payload: MaterialRequestCreate,
    current_user=Depends(get_current_user)
):
    """
    Crear solicitud de material. Cualquier usuario autenticado puede solicitarlo.
    """
    return create_material_request_service(payload, current_user)


@router.get("/material-requests/my")
def my_material_requests(current_user=Depends(get_current_user)):
    """
    Ver mis propias solicitudes. Cualquier usuario autenticado.
    """
    return list_my_material_requests_service(current_user)


@router.get(
    "/material-requests",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def list_all_requests():
    """
    Ver todas las solicitudes (logística).
    """
    return list_all_material_requests_service()


@router.post(
    "/material-requests/{request_id}/approve",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def approve_request(
    request_id: str,
    current_user=Depends(get_current_user)
):
    """
    Aprobar solicitud de material.
    """
    return approve_material_request_service(request_id, current_user)


@router.post(
    "/material-requests/{request_id}/reject",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def reject_request(
    request_id: str,
    current_user=Depends(get_current_user)
):
    """
    Rechazar solicitud de material.
    """
    return reject_material_request_service(request_id, current_user)


@router.get("/material-requests/{request_id}/history")
def get_request_history(
    request_id: str,
    current_user=Depends(get_current_user)
):
    return get_request_history_service(request_id, current_user)


# @router.post(
#     "/reservations/receive",
#     dependencies=[Depends(require_permission("inventory:reservation:receive"))]
# )
# def receive_reservation(
#     payload: ReservationReceptionCreate,
#     current_user=Depends(get_current_user)
# ):
#     return receive_reservation_service(payload, current_user)

# @router.post(
#     "/reservations/{reservation_id}/extend",
#     dependencies=[Depends(require_permission("inventory:reservation:extend"))]
# )
# def extend_reservation(
#     reservation_id: str,
#     current_user=Depends(get_current_user)
# ):
#     return extend_reservation_service(reservation_id, current_user)

@router.get(
    "/material-requests/operational",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def operational_material_requests():
    """
    Vista operativa para logística:
    qué atender hoy, vencidas, y en cola.
    """
    return list_operational_material_requests_service()


@router.get("/dispatches/my")
def my_dispatches(current_user=Depends(get_current_user)):
    """
    Despachos asignados al usuario actual (campo/operaciones).
    """
    return list_my_dispatches_service(current_user)


#=========================================================================================

@router.post(
    "/reservations/{reservation_id}/release",
    dependencies=[Depends(require_permission("logistics:stock:move"))]
)
def release_reservation(
    reservation_id: str,
    current_user=Depends(get_current_user)
):
    """
    Liberar una reserva (BLOCKED → RELEASED).
    No mueve stock físico.
    """
    return release_reservation_service(reservation_id, current_user)
