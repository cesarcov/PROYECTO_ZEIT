from datetime import datetime
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr, ConfigDict


# ── Block schemas ──────────────────────────────────────────────────────────────

class BlockAssignment(BaseModel):
    slug: str
    level: str


class UserBlocksUpdate(BaseModel):
    blocks: List[BlockAssignment]


class UserBlockDetail(BaseModel):
    slug: str
    level: Optional[str] = None
    granted_at: Optional[datetime] = None


class UserBlocksDetailOut(BaseModel):
    user_id: str
    username: str
    blocks: List[UserBlockDetail]


class UserWithBlocksOut(BaseModel):
    id: str
    username: str
    email: str
    is_active: bool
    blocks: List[BlockAssignment]


# ── Tenant schemas ─────────────────────────────────────────────────────────────



class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., pattern=r"^[a-z0-9-]{2,50}$")
    admin_email: EmailStr


class TenantOut(BaseModel):
    id: UUID
    name: str
    slug: str
    is_active: bool
    provision_status: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class TenantOutDetail(TenantOut):
    db_name: str
    provision_error: Optional[str] = None


class TenantOutCreated(TenantOut):
    admin_username: str
    admin_temp_password: str  # One-time credential — transmitir solo por HTTPS, no loggear


class TenantStatusUpdate(BaseModel):
    is_active: bool
