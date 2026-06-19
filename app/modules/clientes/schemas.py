from pydantic import BaseModel
from typing import Optional


class ClienteCreate(BaseModel):
    razon_social: str
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    cargo_contacto: Optional[str] = None
    notas: Optional[str] = None


class ClienteUpdate(BaseModel):
    razon_social: Optional[str] = None
    ruc: Optional[str] = None
    direccion: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
    contacto: Optional[str] = None
    cargo_contacto: Optional[str] = None
    activo: Optional[bool] = None
    notas: Optional[str] = None


class ContactoCreate(BaseModel):
    nombre: str
    cargo: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[str] = None
