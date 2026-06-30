from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from typing import Optional
from datetime import date

from app.core.security.dependencies import get_current_user
from app.core.security.permissions import require_permission
from .schemas import PlanificacionCreate, PlanificacionUpdate, SubtareaCreate, SubtareaAssign, ProductividadCreate, BulkSavePayload, ProductividadStart
from . import service


router = APIRouter(prefix="/planificacion", tags=["Planificación"])

_PLAN_ADMIN = require_permission("planificacion:manage")


# ─── Rutas literales ANTES de /{id} ─────────────────────────────────────────

@router.get("/kpis")
def get_kpis(_=Depends(get_current_user)):
    return service.get_kpis_productividad_service()


@router.get("/actividades/my-pending-count")
def count_my_pending_tasks(user=Depends(get_current_user)):
    return service.count_my_pending_tasks_service(user)


@router.post("/import-excel")
def import_excel(
    file: UploadFile = File(...),
    _=Depends(_PLAN_ADMIN),
):
    content = file.file.read()
    return service.import_planificacion_excel_service(content)


@router.get("/last-import")
def get_last_import(_=Depends(_PLAN_ADMIN)):
    return service.get_last_import_service()


@router.post("/revert-import")
def revert_last_import(_=Depends(_PLAN_ADMIN)):
    try:
        return service.revert_last_import_service()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── CRUD Actividades ────────────────────────────────────────────────────────

@router.get("/actividades")
def list_actividades(
    responsable_id: Optional[str] = Query(None),
    etapa: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    solo_mias: bool = Query(False),
    solo_seguimiento: bool = Query(False),
    user=Depends(get_current_user),
):
    return service.list_actividades_service(
        responsable_id=responsable_id,
        etapa=etapa,
        estado=estado,
        solo_mias=solo_mias,
        solo_seguimiento=solo_seguimiento,
        user=user,
    )


@router.post("/actividades")
def create_actividad(
    data: PlanificacionCreate,
    user=Depends(_PLAN_ADMIN),
):
    return service.create_actividad_service(data, user)


# IMPORTANTE: rutas literales ANTES de /actividades/{id}
@router.get("/actividades/export")
def export_actividades(
    fecha_inicio: Optional[str] = Query(None),
    fecha_fin: Optional[str] = Query(None),
    prioridad: Optional[str] = Query(None),
    estado: Optional[str] = Query(None),
    cliente: Optional[str] = Query(None),
    responsable: Optional[str] = Query(None),
    _=Depends(_PLAN_ADMIN),
):
    return service.export_planificacion_excel_service(
        fecha_inicio=fecha_inicio,
        fecha_fin=fecha_fin,
        prioridad=prioridad,
        estado=estado,
        cliente=cliente,
        responsable=responsable,
    )


@router.post("/actividades/bulk")
def bulk_save_actividades(
    data: BulkSavePayload,
    user=Depends(_PLAN_ADMIN),
):
    return service.bulk_save_actividades_service(data, user)


@router.get("/actividades/{actividad_id}/historial")
def list_historial(actividad_id: str, _=Depends(get_current_user)):
    return service.list_historial_service(actividad_id)


@router.get("/actividades/{actividad_id}")
def get_actividad(actividad_id: str, _=Depends(get_current_user)):
    item = service.get_actividad_service(actividad_id)
    if not item:
        raise HTTPException(status_code=404, detail="Actividad no encontrada")
    return item


@router.patch("/actividades/{actividad_id}")
def update_actividad(
    actividad_id: str,
    data: PlanificacionUpdate,
    user=Depends(_PLAN_ADMIN),
):
    return service.update_actividad_service(actividad_id, data, user)


@router.delete("/actividades/{actividad_id}")
def delete_actividad(
    actividad_id: str,
    _=Depends(_PLAN_ADMIN),
):
    return service.delete_actividad_service(actividad_id)


# ─── Subtareas ───────────────────────────────────────────────────────────────

@router.post("/actividades/{actividad_id}/subtareas")
def create_subtarea(
    actividad_id: str,
    data: SubtareaCreate,
    _=Depends(get_current_user),
):
    return service.create_subtarea_service(actividad_id, data.descripcion)


@router.patch("/actividades/{actividad_id}/subtareas/{subtarea_id}/toggle")
def toggle_subtarea(
    actividad_id: str,
    subtarea_id: str,
    user=Depends(get_current_user),
):
    result = service.toggle_subtarea_service(actividad_id, subtarea_id, user)
    if not result:
        raise HTTPException(status_code=404, detail="Subtarea no encontrada")
    return result


@router.patch("/actividades/{actividad_id}/subtareas/{subtarea_id}/assign")
def assign_subtarea(
    actividad_id: str,
    subtarea_id: str,
    payload: SubtareaAssign,
    user=Depends(get_current_user),
):
    result = service.assign_subtarea_service(actividad_id, subtarea_id, payload.responsable_id, user)
    if not result:
        raise HTTPException(status_code=404, detail="Subtarea no encontrada")
    return result



@router.delete("/actividades/{actividad_id}/subtareas/{subtarea_id}")
def delete_subtarea(
    actividad_id: str,
    subtarea_id: str,
    _=Depends(get_current_user),
):
    return service.delete_subtarea_service(actividad_id, subtarea_id)


# ─── Productividad ───────────────────────────────────────────────────────────

@router.get("/productividad/admin")
def list_productividad_admin(
    user_id: Optional[str] = Query(None),
    fecha: Optional[date] = Query(None),
    mes: Optional[str] = Query(None),
    _=Depends(_PLAN_ADMIN),
):
    return service.list_productividad_admin_service(user_id, fecha, mes)


@router.get("/productividad/export")
def export_productividad(
    user_id: Optional[str] = Query(None),
    fecha: Optional[date] = Query(None),
    mes: Optional[str] = Query(None),
    _=Depends(_PLAN_ADMIN),
):
    return service.export_productividad_excel_service(user_id, fecha, mes)


@router.get("/productividad/mis-logs")
def list_mis_logs(
    fecha: Optional[date] = Query(None),
    user=Depends(get_current_user),
):
    return service.list_productividad_service(user["id"], fecha)


@router.get("/productividad/active")
def get_active_log(user=Depends(get_current_user)):
    return service.get_active_productividad_service(user)


@router.post("/productividad/start")
def start_timer(data: ProductividadStart, user=Depends(get_current_user)):
    return service.start_productividad_service(data, user)


@router.post("/productividad/stop")
def stop_timer(user=Depends(get_current_user)):
    res = service.stop_productividad_service(user)
    if not res:
        raise HTTPException(status_code=404, detail="No hay ningún temporizador activo corriendo")
    return res


@router.post("/productividad")
def create_log(data: ProductividadCreate, user=Depends(get_current_user)):
    return service.create_productividad_service(data, user)


@router.delete("/productividad/{log_id}")
def delete_log(log_id: str, user=Depends(get_current_user)):
    return service.delete_productividad_service(log_id, user["id"])


@router.get("/users")
def list_active_users(_=Depends(get_current_user)):
    return service.list_active_users_service()


