from pydantic import BaseModel
from typing import Optional


class SolicitudCreate(BaseModel):
    to_module: str
    subject: str
    description: Optional[str] = None
    priority: str = "NORMAL"


class SolicitudStatusUpdate(BaseModel):
    status: str


class MensajeCreate(BaseModel):
    mensaje: str


class SolicitudAssign(BaseModel):
    assigned_to: Optional[str] = None

