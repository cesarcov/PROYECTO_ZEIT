from fastapi import APIRouter
from app.modules.logistics.schemas import (
    StockMovementCreate,
    StockMovementResponse
)

router = APIRouter(
    prefix="/logistics",
    tags=["Logistics"]
)


@router.get("/health")
def logistics_health():
    return {"status": "Logistics module OK"}


@router.post(
    "/stock-movements/",
    response_model=StockMovementResponse
)
def create_stock_movement(payload: StockMovementCreate):
    """
    Crear movimiento de stock (entrada, salida, ajuste, etc.)
    """
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        **payload.model_dump(),
        "created_at": "2025-01-01T00:00:00"
    }
