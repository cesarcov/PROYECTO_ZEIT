from pydantic import BaseModel
from typing import Optional


VALID_TIPOS     = ("CORRECTIVO", "PREVENTIVO", "EMERGENCIA")
VALID_PRIORIDAD = ("URGENTE", "ALTA", "NORMAL", "BAJA")
VALID_STATUS    = ("PENDIENTE", "EN_EJECUCION", "PAUSADA", "COMPLETADA", "CERRADA", "CANCELADA")


class OTCreate(BaseModel):
    titulo: str
    descripcion: Optional[str] = None
    tipo: str = "CORRECTIVO"
    prioridad: str = "NORMAL"
    plan_id: Optional[str] = None
    partida_id: Optional[str] = None
    asignado_a: Optional[str] = None
    fecha_inicio_plan: Optional[str] = None
    fecha_fin_plan: Optional[str] = None
    horas_estimadas: Optional[float] = None
    lugar_trabajo: Optional[str] = None
    observaciones: Optional[str] = None


class OTUpdate(BaseModel):
    titulo: Optional[str] = None
    descripcion: Optional[str] = None
    tipo: Optional[str] = None
    prioridad: Optional[str] = None
    asignado_a: Optional[str] = None
    fecha_inicio_plan: Optional[str] = None
    fecha_fin_plan: Optional[str] = None
    horas_estimadas: Optional[float] = None
    lugar_trabajo: Optional[str] = None
    observaciones: Optional[str] = None


class OTStatusUpdate(BaseModel):
    status: str
    notas: Optional[str] = None


class ChecklistItemCreate(BaseModel):
    descripcion: str
    orden: int = 0


class ChecklistItemToggle(BaseModel):
    completado: bool
    notas: Optional[str] = None


class MaterialOTCreate(BaseModel):
    material_id: str
    almacen_id: Optional[str] = None
    cantidad_real: float
    cantidad_plan: Optional[float] = None


class MaterialOTUpdate(BaseModel):
    cantidad_real: Optional[float] = None
    almacen_id: Optional[str] = None


class TiempoIniciarPayload(BaseModel):
    notas: Optional[str] = None


class TiempoPausarPayload(BaseModel):
    notas: Optional[str] = None


class GenerarOCPayload(BaseModel):
    mat_item_id: str        # ot_materiales.id — ítem específico a vincular
    material_id: str
    cantidad_faltante: float
    almacen_id: Optional[str] = None
    proveedor_id: Optional[str] = None  # Si el usuario elige de la lista
