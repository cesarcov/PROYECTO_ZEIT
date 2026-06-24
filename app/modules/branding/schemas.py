from pydantic import BaseModel
from typing import Optional


class BrandingUpdate(BaseModel):
    nombre_producto: Optional[str] = None
    eslogan: Optional[str] = None
    logo_incluye_nombre: Optional[bool] = None
    color_primario: Optional[str] = None
    color_acento: Optional[str] = None
    color_accion: Optional[str] = None
