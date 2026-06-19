from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime

class AprobacionDecidir(BaseModel):
    decision: str  # 'APROBADO' | 'RECHAZADO'
    notas_gerencia: Optional[str] = None

class AprobacionOut(BaseModel):
    id: str
    tipo: str
    referencia_id: str
    titulo: str
    descripcion: str
    monto: Optional[float] = None
    estado: str
    solicitado_por: str
    solicitante_username: Optional[str] = None
    notas_gerencia: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    detalles: Optional[Dict[str, Any]] = None
