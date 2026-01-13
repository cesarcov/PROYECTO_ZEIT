from pydantic import BaseModel, Field
from typing import Optional, Literal, List
from uuid import UUID
from datetime import datetime, date

# ============================================================
# 📦 STOCK MOVEMENTS (MOVIMIENTOS)
# ============================================================

# -------------------------
# INPUT (POST /stock-movements)
# -------------------------
class StockMovementCreate(BaseModel):
    material_id: UUID
    warehouse_id: UUID

    movement_type: Literal["IN", "OUT", "RETURN", "ADJUST", "TRANSFER"]
    quantity: float = Field(..., gt=0)

    # 📍 Ubicación física (opcional aquí, se valida en service.py)
    project_id: Optional[UUID] = None
    rack: Optional[str] = None
    level: Optional[str] = None
    box: Optional[str] = None
    position: Optional[str] = None

    to_rack: Optional[str] = None
    to_level: Optional[str] = None
    to_box: Optional[str] = None
    to_position: Optional[str] = None

    reference: Optional[str] = None
    notes: Optional[str] = None
    created_by: Optional[str] = "system"


# -------------------------
# OUTPUT (Response)
# -------------------------
class StockMovementResponse(BaseModel):
    id: UUID
    material_id: UUID
    movement_type: str
    quantity: float

    from_warehouse: Optional[UUID]
    to_warehouse: Optional[UUID]
    project_id: Optional[UUID]
    reference: Optional[str]
    notes: Optional[str]
    created_by: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================
# 📍 STOCK LOCATIONS (UBICACIONES FÍSICAS)
# ============================================================

# -------------------------
# INPUT (POST /stock-locations)
# -------------------------
class StockLocationCreate(BaseModel):
    material_id: UUID
    warehouse_id: UUID

    rack: str
    level: str
    box: str
    position: Optional[str] = None

    quantity: float = Field(..., ge=0)


# -------------------------
# OUTPUT (Response)
# -------------------------
class StockLocationResponse(StockLocationCreate):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class StockMovementWithLocation(StockMovementCreate):
    rack: Optional[str] = None
    level: Optional[str] = None
    box: Optional[str] = None
    position: Optional[str] = None

    # 🔁 DESTINO PARA TRANSFER
    to_rack: Optional[str] = None
    to_level: Optional[str] = None
    to_box: Optional[str] = None
    to_position: Optional[str] = None

class ToolAssignCreate(BaseModel):
    material_id: UUID
    project_id: UUID
    assigned_to: str
    expected_return: Optional[date] = None
    condition_out: str   # NUEVO → NUEVO | BUENO | REGULAR | DAÑADO

class ToolReturn(BaseModel):
    assignment_id: UUID
    
class ToolReturnRequest(BaseModel):
    assignment_id: UUID
    condition_in: str              # NUEVO → BUENO | REGULAR | DAÑADO
    return_notes: Optional[str] = None


class ToolMaintenanceCreate(BaseModel):
    material_id: UUID
    maintenance_type: str  # CALIBRATION | PREVENTIVE | REPAIR
    last_maintenance: date
    next_due: date
    notes: Optional[str] = None

# ============================================================
# 📦 MATERIALES / EQUIPOS / EPP
# ============================================================

# -------------------------
# INPUT
# -------------------------
class MaterialCreate(BaseModel):
    name: str
    code: str
    min_stock: float = Field(..., ge=0)
    category: str
    aliases: Optional[List[str]] = []   # 👈 Hasta 3 nombres alternativos

# -------------------------
# OUTPUT
# -------------------------
class MaterialResponse(BaseModel):
    id: UUID
    name: str
    code: str
    min_stock: float
    category: str
    aliases: List[str]
    created_at: datetime

    class Config:
        from_attributes = True
# ============================================================
# 🏬 WAREHOUSES
# ============================================================

class WarehouseCreate(BaseModel):
    code: str
    name: str
    location: Optional[str] = None


class WarehouseResponse(WarehouseCreate):
    id: UUID

# ============================================================
# 🏗 PROJECTS
# ============================================================

class ProjectCreate(BaseModel):
    code: str
    name: str


class ProjectResponse(ProjectCreate):
    id: UUID

# ============================================================
# 🏬 WAREHOUSES
# ============================================================
class WarehouseCreate(BaseModel):
    code: str
    name: str
    location: Optional[str] = None

class WarehouseResponse(WarehouseCreate):
    id: UUID

# ============================================================
# 🏗 PROJECTS
# ============================================================
class ProjectCreate(BaseModel):
    code: str
    name: str

class ProjectResponse(ProjectCreate):
    id: UUID
