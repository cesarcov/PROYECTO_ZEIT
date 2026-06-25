from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.rate_limit import limiter
from app.core.security.dependencies import get_current_user
from app.modules.superadmin.schemas import (
    TenantCreate,
    TenantOut,
    TenantOutDetail,
    TenantOutCreated,
    TenantStatusUpdate,
)
from app.modules.superadmin.service import (
    provision_tenant,
    list_tenants,
    get_tenant,
    update_tenant_status,
)

router = APIRouter(prefix="/superadmin", tags=["Superadmin"])


def require_superadmin(current_user=Depends(get_current_user)):
    if current_user.get("role") != "superadmin":
        raise HTTPException(403, "Acceso restringido al superadmin.")
    return current_user


@router.post("/tenants", status_code=201, response_model=TenantOutCreated)
@limiter.limit("10/minute")
def create_tenant(request: Request, payload: TenantCreate, _=Depends(require_superadmin)):
    return provision_tenant(payload)


@router.get("/tenants", response_model=List[TenantOut])
def get_all_tenants(_=Depends(require_superadmin)):
    return list_tenants()


@router.get("/tenants/{tenant_id}", response_model=TenantOutDetail)
def get_tenant_detail(tenant_id: UUID, _=Depends(require_superadmin)):
    return get_tenant(tenant_id)


@router.patch("/tenants/{tenant_id}/status", response_model=TenantOut)
def patch_tenant_status(
    tenant_id: UUID,
    payload: TenantStatusUpdate,
    _=Depends(require_superadmin),
):
    return update_tenant_status(tenant_id, payload.is_active)
