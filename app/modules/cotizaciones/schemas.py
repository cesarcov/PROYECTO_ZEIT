from pydantic import BaseModel
from typing import Optional


# ── Recursos de Mano de Obra ──────────────────────────────────────────────────

class RecursoMOCreate(BaseModel):
    codigo: str
    descripcion: str
    categoria: str = "Operario"
    tarifa_hora: float
    unidad: str = "HH"


class RecursoMOUpdate(BaseModel):
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    tarifa_hora: Optional[float] = None
    unidad: Optional[str] = None
    activo: Optional[bool] = None


# ── Partidas del presupuesto ──────────────────────────────────────────────────

class PartidaCreate(BaseModel):
    codigo: str
    descripcion: str
    unidad: str = "GLB"
    cantidad: float = 1.0
    orden: int = 0
    es_capitulo: bool = False
    parent_id: Optional[str] = None


class PartidaUpdate(BaseModel):
    codigo: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: Optional[float] = None
    orden: Optional[int] = None


# ── Ítems APU ─────────────────────────────────────────────────────────────────

class APUItemCreate(BaseModel):
    tipo_recurso: str                   # MATERIAL | MANO_OBRA | EQUIPO
    material_id: Optional[str] = None
    recurso_mo_id: Optional[str] = None
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad: float
    precio_unitario: float


class APUItemUpdate(BaseModel):
    cantidad: Optional[float] = None
    precio_unitario: Optional[float] = None
    descripcion: Optional[str] = None


# ── Configuración del presupuesto ─────────────────────────────────────────────

class PresupuestoConfigUpdate(BaseModel):
    gastos_generales_pct: Optional[float] = None
    utilidad_pct: Optional[float] = None
    igv_pct: Optional[float] = None
    moneda: Optional[str] = None
    cliente_id: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_ruc: Optional[str] = None
    contacto_id: Optional[str] = None
    lugar_trabajo: Optional[str] = None
    plazo_dias: Optional[int] = None
    validez_dias: Optional[int] = None
    notas: Optional[str] = None
    notas_comerciales: Optional[str] = None



# ── Ciclo de estados de cotización ────────────────────────────────────────────

class CotizacionStatusUpdate(BaseModel):
    status: str   # ENVIADA | APROBADA | RECHAZADA | EXPIRADA | BORRADOR


# ── APU Bulk ──────────────────────────────────────────────────────────────────

class APUBulkCreate(BaseModel):
    items: list[APUItemCreate]


# ── Baúles APU ────────────────────────────────────────────────────────────────

class BaulCreate(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    categoria: str = "general"


class BaulUpdate(BaseModel):
    nombre: Optional[str] = None
    descripcion: Optional[str] = None
    categoria: Optional[str] = None
    activo: Optional[bool] = None


class BaulItemCreate(BaseModel):
    tipo_recurso: str
    material_id: Optional[str] = None
    recurso_mo_id: Optional[str] = None
    descripcion: str
    unidad: str = "UND"
    cantidad_base: float = 1.0
    precio_unitario: float = 0.0
    orden: int = 0


class BaulItemUpdate(BaseModel):
    descripcion: Optional[str] = None
    unidad: Optional[str] = None
    cantidad_base: Optional[float] = None
    precio_unitario: Optional[float] = None
    orden: Optional[int] = None


# ── Categorías de Costo ───────────────────────────────────────────────────────

class CategoriaCostoCreate(BaseModel):
    codigo: str
    nombre: str
    es_directo: bool = True
    orden: int = 0
    color_hex: Optional[str] = '#4F7C82'


class CategoriaCostoUpdate(BaseModel):
    nombre: Optional[str] = None
    es_directo: Optional[bool] = None
    orden: Optional[int] = None
    color_hex: Optional[str] = None
    activo: Optional[bool] = None


# ── Tarifas de Personal (Matriz contextual) ───────────────────────────────────

class TarifaPersonalCreate(BaseModel):
    rol: str
    contexto: str          # PARADA | PROYECTO | SERVICIO | INGENIERIA
    ubicacion: str         # MINA | AREQUIPA | INDUSTRIA | CUALQUIERA
    modalidad: str         # HORA | DIA
    horas_por_dia: int = 8
    tarifa: float
    tarifa_hora_extra: Optional[float] = None
    moneda: str = "PEN"
    incluye_epp: bool = False
    incluye_herramientas: bool = False
    notas: Optional[str] = None


class TarifaPersonalUpdate(BaseModel):
    rol: Optional[str] = None
    contexto: Optional[str] = None
    ubicacion: Optional[str] = None
    modalidad: Optional[str] = None
    horas_por_dia: Optional[int] = None
    tarifa: Optional[float] = None
    tarifa_hora_extra: Optional[float] = None
    moneda: Optional[str] = None
    incluye_epp: Optional[bool] = None
    incluye_herramientas: Optional[bool] = None
    notas: Optional[str] = None
    activo: Optional[bool] = None
