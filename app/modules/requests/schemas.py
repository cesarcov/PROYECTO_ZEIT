from pydantic import BaseModel, Field
from uuid import UUID
from typing import Optional, List
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

class MaterialRequestItemCreate(BaseModel):
    material_id: UUID
    quantity: float = Field(..., gt=0)


class MaterialRequestCreate(BaseModel):
    # Modo multi-item (nuevo)
    items: Optional[List[MaterialRequestItemCreate]] = None
    # Modo legacy — backward compat (se mantiene)
    related_material_id: Optional[UUID] = None
    quantity: Optional[float] = Field(None, gt=0)
    reason: str
    project_id: UUID


class MaterialRequestItemOut(BaseModel):
    material_id: UUID
    material_name: str
    material_code: str
    quantity: float


class MaterialRequestAuditOut(BaseModel):
    id: UUID
    action: str
    old_status: Optional[str]
    new_status: Optional[str]
    actor_name: Optional[str]
    source: str
    created_at: datetime

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
