from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field, EmailStr


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

    class Config:
        from_attributes = True


class TenantOutDetail(TenantOut):
    db_name: str
    provision_error: Optional[str] = None


class TenantOutCreated(TenantOut):
    admin_username: str
    admin_temp_password: str  # One-time credential — transmitir solo por HTTPS, no loggear


class TenantStatusUpdate(BaseModel):
    is_active: bool
