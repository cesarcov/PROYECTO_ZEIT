from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query

from app.core.security.permissions import require_permission
from .schemas import BrandingUpdate
from . import service

router = APIRouter(prefix="/branding", tags=["Branding"])

# Escrituras: solo admin. (GET es público: lo usa el login antes de autenticar.)
_ADMIN = require_permission("admin:users")


@router.get("")
def get_branding():
    return service.get_branding_public()


@router.put("")
def update_branding(payload: BrandingUpdate, _=Depends(_ADMIN)):
    try:
        return service.update_branding(payload.model_dump(exclude_unset=True))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.post("/logo")
def upload_logo(
    variant: str = Query(...),
    file: UploadFile = File(...),
    _=Depends(_ADMIN),
):
    content = file.file.read()
    try:
        url = service.save_logo(variant, file.filename, content)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"variant": variant, "path": url}


@router.delete("")
def reset_branding(_=Depends(_ADMIN)):
    return service.reset_branding()
