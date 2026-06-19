from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.core.security.dependencies import get_current_user

from app.modules.reporting.service import (
    get_requests_kpi_summary_service,
    get_material_requests_sla_kpi_service,
    get_material_requests_summary_kpi_service,
    get_material_requests_lead_time_kpi_service,
    get_material_requests_by_approver_kpi_service,
    get_material_requests_monthly_kpi_service,
    get_dashboard_kpis_service,
    export_dashboard_kpis_excel_service,
)

router = APIRouter(
    prefix="/reporting/requests",
    tags=["Reporting"],
    dependencies=[Depends(get_current_user)]
)

# ===============================
# 📊 KPIs - Solicitudes de Material
# ===============================

@router.get("/kpis/summary")
def requests_kpi_summary():
    return get_requests_kpi_summary_service()


@router.get("/kpis/material-requests/summary")
def material_requests_summary_kpi():
    return get_material_requests_summary_kpi_service()


@router.get("/kpis/material-requests/sla")
def material_requests_sla_kpi():
    return get_material_requests_sla_kpi_service()


@router.get("/kpis/material-requests/lead-time")
def material_requests_lead_time_kpi():
    return get_material_requests_lead_time_kpi_service()


@router.get("/kpis/material-requests/by-approver")
def material_requests_by_approver_kpi():
    return get_material_requests_by_approver_kpi_service()


@router.get("/kpis/material-requests/monthly")
def material_requests_monthly_kpi():
    return get_material_requests_monthly_kpi_service()


@router.get("/kpis/dashboard-export")
def export_dashboard_kpis(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    logistics: bool = Query(True),
    operations: bool = Query(True),
    compras: bool = Query(True),
    admin: bool = Query(True),
    weak_points: bool = Query(True),
):
    return export_dashboard_kpis_excel_service(
        desde=desde, hasta=hasta,
        include_logistics=logistics,
        include_operations=operations,
        include_compras=compras,
        include_admin=admin,
        include_weak_points=weak_points,
    )


@router.get("/kpis/dashboard-kpis")
def get_dashboard_kpis(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
):
    return get_dashboard_kpis_service(desde=desde, hasta=hasta)
