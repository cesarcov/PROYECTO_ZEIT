from pydantic import BaseModel
from typing import Optional, List
from datetime import date, time


class PlanificacionCreate(BaseModel):
    prioridad: Optional[str] = None          # 'Alta', 'Media', 'Baja'
    tarea: str
    cliente: Optional[str] = None
    contacto: Optional[str] = None
    fecha_solicitud: Optional[date] = None
    responsable_id: Optional[str] = None
    etapa: Optional[str] = None
    estado: Optional[str] = "En Progreso"
    fecha_limite: Optional[date] = None
    seguimiento_id: Optional[str] = None
    responsables_ids: Optional[str] = None
    seguimientos_ids: Optional[str] = None
    contactos_ids: Optional[str] = None
    notas: Optional[str] = None


class PlanificacionUpdate(BaseModel):
    prioridad: Optional[str] = None
    tarea: Optional[str] = None
    cliente: Optional[str] = None
    contacto: Optional[str] = None
    fecha_solicitud: Optional[date] = None
    responsable_id: Optional[str] = None
    etapa: Optional[str] = None
    estado: Optional[str] = None
    fecha_limite: Optional[date] = None
    seguimiento_id: Optional[str] = None
    responsables_ids: Optional[str] = None
    seguimientos_ids: Optional[str] = None
    contactos_ids: Optional[str] = None
    notas: Optional[str] = None
    progreso_pct: Optional[float] = None


class SubtareaCreate(BaseModel):
    descripcion: str


class SubtareaAssign(BaseModel):
    responsable_id: Optional[str] = None



class ProductividadCreate(BaseModel):
    actividad: str
    hora_inicio: Optional[time] = None
    hora_fin: Optional[time] = None
    actividad_semanal_id: Optional[str] = None
    fecha: Optional[date] = None             # si None → hoy en el backend


class ProductividadStart(BaseModel):
    actividad: str
    actividad_semanal_id: Optional[str] = None



class PlanificacionBulkItem(BaseModel):
    id: Optional[str] = None                 # None o "temp-*" → INSERT, UUID → UPDATE
    prioridad: Optional[str] = None
    tarea: str
    cliente: Optional[str] = None
    contacto: Optional[str] = None
    fecha_solicitud: Optional[str] = None    # "YYYY-MM-DD" o None
    responsable_id: Optional[str] = None
    etapa: Optional[str] = None
    estado: Optional[str] = "En Progreso"
    fecha_limite: Optional[str] = None       # "YYYY-MM-DD" o None
    seguimiento_id: Optional[str] = None
    responsables_ids: Optional[str] = None
    seguimientos_ids: Optional[str] = None
    contactos_ids: Optional[str] = None
    notas: Optional[str] = None


class BulkSavePayload(BaseModel):
    upsert: List[PlanificacionBulkItem]
    delete: List[str]                        # UUIDs a eliminar
