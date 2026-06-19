from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional
from datetime import datetime


# ===============================
# RESERVAS
# ===============================

class ReservationCreate(BaseModel):
    material_request_id: UUID
    material_id: UUID
    warehouse_id: UUID
    quantity: float = Field(..., gt=0)
    project_id: Optional[UUID] = None
    notes: Optional[str] = None


class ReservationResponse(BaseModel):
    id: UUID
    material_id: UUID
    quantity: float
    status: str
    created_at: datetime


# ===============================
# SOLICITUDES DE MATERIAL
# ===============================


class MaterialRequestCreate(BaseModel):
    related_material_id: UUID
    quantity: float = Field(..., gt=0)
    reason: str
    project_id: UUID

# ===============================
# LÓGICA DE RECEPCIÓN
# ===============================

class ReservationReceptionCreate(BaseModel):
    reservation_id: UUID
    to_warehouse_id: UUID

    rack: Optional[str] = None
    level: Optional[str] = None
    box: Optional[str] = None
    position: Optional[str] = None

    received_by: Optional[str] = None
