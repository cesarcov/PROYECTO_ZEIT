from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.security.dependencies import get_current_user
from app.modules.compras.schemas import (
    ProveedorCreate, ProveedorUpdate,
    MaterialProveedorCreate,
    OCCreate, OCUpdate, OCStatusUpdate,
    OCItemCreate, OCItemUpdate,
    OCRecepcion,
)
from app.modules.compras.service import (
    list_proveedores_service,
    create_proveedor_service,
    update_proveedor_service,
    get_proveedor_materiales_service,
    add_material_proveedor_service,
    delete_material_proveedor_service,
    list_material_proveedores_service,
    list_oc_service,
    create_oc_service,
    get_oc_service,
    update_oc_service,
    change_oc_status_service,
    add_oc_item_service,
    update_oc_item_service,
    delete_oc_item_service,
    recibir_oc_service,
    export_oc_excel_service,
    export_proveedores_excel_service,
)

router = APIRouter(prefix="/compras", tags=["Compras"])


# ── Proveedores ───────────────────────────────────────────────────────────────

@router.get("/proveedores")
def list_proveedores(
    activo: Optional[bool] = Query(None),
    current_user=Depends(get_current_user),
):
    return list_proveedores_service(activo=activo)


@router.post("/proveedores")
def create_proveedor(payload: ProveedorCreate, current_user=Depends(get_current_user)):
    return create_proveedor_service(payload)


@router.get("/proveedores/export")
def export_proveedores_excel(current_user=Depends(get_current_user)):
    return export_proveedores_excel_service()


@router.patch("/proveedores/{proveedor_id}")
def update_proveedor(proveedor_id: str, payload: ProveedorUpdate, current_user=Depends(get_current_user)):
    return update_proveedor_service(proveedor_id, payload)


@router.get("/proveedores/{proveedor_id}/materiales")
def get_proveedor_materiales(proveedor_id: str, current_user=Depends(get_current_user)):
    return get_proveedor_materiales_service(proveedor_id)


# ── Catálogo material-proveedor ───────────────────────────────────────────────

@router.get("/materiales/{material_id}/proveedores")
def list_material_proveedores(material_id: str, current_user=Depends(get_current_user)):
    return list_material_proveedores_service(material_id)


@router.post("/materiales/{material_id}/proveedores")
def add_material_proveedor(material_id: str, payload: MaterialProveedorCreate, current_user=Depends(get_current_user)):
    return add_material_proveedor_service(material_id, payload)


@router.delete("/materiales/{material_id}/proveedores/{mp_id}")
def delete_material_proveedor(material_id: str, mp_id: str, current_user=Depends(get_current_user)):
    return delete_material_proveedor_service(material_id, mp_id)


# ── Órdenes de Compra ─────────────────────────────────────────────────────────

@router.get("/oc")
def list_oc(
    status:        Optional[str] = Query(None),
    proveedor_id:  Optional[str] = Query(None),
    plan_id:       Optional[str] = Query(None),
    mis:           Optional[bool] = Query(None),
    current_user=Depends(get_current_user),
):
    solicitado_por = current_user["id"] if mis else None
    return list_oc_service(
        status=status, proveedor_id=proveedor_id,
        plan_id=plan_id, solicitado_por=solicitado_por
    )


@router.post("/oc")
def create_oc(payload: OCCreate, current_user=Depends(get_current_user)):
    return create_oc_service(payload, current_user)


@router.get("/oc/export")
def export_oc_excel(
    status:       Optional[str] = Query(None),
    proveedor_id: Optional[str] = Query(None),
    current_user=Depends(get_current_user),
):
    return export_oc_excel_service(status=status, proveedor_id=proveedor_id)


@router.get("/oc/{oc_id}")
def get_oc(oc_id: str, current_user=Depends(get_current_user)):
    return get_oc_service(oc_id)


@router.patch("/oc/{oc_id}")
def update_oc(oc_id: str, payload: OCUpdate, current_user=Depends(get_current_user)):
    return update_oc_service(oc_id, payload)


@router.patch("/oc/{oc_id}/status")
def change_oc_status(oc_id: str, payload: OCStatusUpdate, current_user=Depends(get_current_user)):
    return change_oc_status_service(oc_id, payload, current_user)


@router.post("/oc/{oc_id}/items")
def add_oc_item(oc_id: str, payload: OCItemCreate, current_user=Depends(get_current_user)):
    return add_oc_item_service(oc_id, payload)


@router.patch("/oc/{oc_id}/items/{item_id}")
def update_oc_item(oc_id: str, item_id: str, payload: OCItemUpdate, current_user=Depends(get_current_user)):
    return update_oc_item_service(oc_id, item_id, payload)


@router.delete("/oc/{oc_id}/items/{item_id}")
def delete_oc_item(oc_id: str, item_id: str, current_user=Depends(get_current_user)):
    return delete_oc_item_service(oc_id, item_id)


@router.post("/oc/{oc_id}/recibir")
def recibir_oc(oc_id: str, payload: OCRecepcion, current_user=Depends(get_current_user)):
    return recibir_oc_service(oc_id, payload, current_user)
