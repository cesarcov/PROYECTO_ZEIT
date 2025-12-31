from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime


# =========================
# STOCK MOVEMENTS
# =========================

class StockMovementBase(BaseModel):
    material_id: UUID
    warehouse_id: UUID
    project_id: Optional[UUID] = None

    movement_type: str = Field(
        ..., description="IN, OUT, TRANSFER, ADJUST, RETURN"
    )

    quantity: float = Field(..., gt=0)

    reference: Optional[str] = None
    notes: Optional[str] = None


class StockMovementCreate(StockMovementBase):
    created_by: Optional[str] = "system"


class StockMovementResponse(StockMovementBase):
    id: UUID
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True
