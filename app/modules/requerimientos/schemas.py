from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date

class RequerimientoCreate(BaseModel):
    cliente_id: str
    nombre_servicio: str
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = "Cotizado"

class RequerimientoUpdate(BaseModel):
    nombre_servicio: Optional[str] = None
    descripcion: Optional[str] = None
    fecha_inicio: Optional[date] = None
    fecha_fin: Optional[date] = None
    estado: Optional[str] = None

class CostoItemPayload(BaseModel):
    id: Optional[str] = None
    categoria: str
    descripcion: str
    costo_unitario: float
    cantidad: float
    detalles: Optional[Dict[str, Any]] = None

class BulkCostosPayload(BaseModel):
    upsert: List[CostoItemPayload]
    delete: List[str]
