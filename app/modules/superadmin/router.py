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
    UserBlocksUpdate,
    UserBlocksDetailOut,
    UserWithBlocksOut,
)
from app.modules.superadmin.service import (
    provision_tenant,
    list_tenants,
    get_tenant,
    update_tenant_status,
    get_users_with_blocks_service,
    get_user_blocks_by_id_service,
    set_user_blocks_service,
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


# ── Block management endpoints ─────────────────────────────────────────────────

@router.get("/users", response_model=List[UserWithBlocksOut])
def list_users_with_blocks(_=Depends(require_superadmin)):
    return get_users_with_blocks_service()


@router.get("/users/{user_id}/blocks", response_model=UserBlocksDetailOut)
def get_user_blocks_detail(user_id: str, _=Depends(require_superadmin)):
    return get_user_blocks_by_id_service(user_id)


@router.put("/users/{user_id}/blocks", response_model=UserBlocksDetailOut)
def set_user_blocks(
    user_id: str,
    payload: UserBlocksUpdate,
    current_user=Depends(require_superadmin),
):
    blocks = [{"slug": b.slug, "level": b.level} for b in payload.blocks]
    granted_by = current_user.get("id") if current_user.get("id") != "superadmin" else None
    return set_user_blocks_service(user_id, blocks, granted_by)
