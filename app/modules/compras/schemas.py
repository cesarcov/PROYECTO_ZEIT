from pydantic import BaseModel
from typing import Optional, List


VALID_TIPOS_PROV = ("PROVEEDOR", "SUBCONTRATISTA")
VALID_STATUS_OC  = ("BORRADOR", "ENVIADA", "APROBADA", "EN_TRANSITO", "RECIBIDA", "CERRADA", "CANCELADA")

TRANSICIONES_OC = {
    "BORRADOR":    ["ENVIADA", "CANCELADA"],
    "ENVIADA":     ["APROBADA", "CANCELADA"],
    "APROBADA":    ["EN_TRANSITO", "CANCELADA"],
    "EN_TRANSITO": ["RECIBIDA", "CANCELADA"],
    "RECIBIDA":    ["CERRADA"],
    "CERRADA":     [],
    "CANCELADA":   [],
}


# ── Proveedores ───────────────────────────────────────────────────────────────

class ProveedorCreate(BaseModel):
    nombre: str
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    tipo: str = "PROVEEDOR"


class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    tipo: Optional[str] = None
    activo: Optional[bool] = None


# ── Catálogo material-proveedor ───────────────────────────────────────────────

class MaterialProveedorCreate(BaseModel):
    proveedor_id: str
    precio_unitario: float
    moneda: str = "PEN"
    tiempo_entrega_dias: int = 1
    es_principal: bool = False


class MaterialProveedorUpdate(BaseModel):
    precio_unitario: Optional[float] = None
    moneda: Optional[str] = None
    tiempo_entrega_dias: Optional[int] = None
    es_principal: Optional[bool] = None


# ── Órdenes de Compra ─────────────────────────────────────────────────────────

class OCItemCreate(BaseModel):
    material_id: str
    cantidad_pedida: float
    precio_unitario: float
    notas: Optional[str] = None


class OCItemUpdate(BaseModel):
    cantidad_pedida: Optional[float] = None
    precio_unitario: Optional[float] = None
    notas: Optional[str] = None


class OCCreate(BaseModel):
    proveedor_id: str
    plan_id: Optional[str] = None
    almacen_destino: Optional[str] = None
    fecha_entrega_est: Optional[str] = None
    notas: Optional[str] = None
    items: List[OCItemCreate] = []


class OCUpdate(BaseModel):
    proveedor_id: Optional[str] = None
    plan_id: Optional[str] = None
    almacen_destino: Optional[str] = None
    fecha_entrega_est: Optional[str] = None
    notas: Optional[str] = None


class OCStatusUpdate(BaseModel):
    status: str
    notas: Optional[str] = None


class OCRecepcionItem(BaseModel):
    item_id: str
    cantidad_recibida: float
    almacen_id: Optional[str] = None


class OCRecepcion(BaseModel):
    items: List[OCRecepcionItem]
    almacen_id: Optional[str] = None
