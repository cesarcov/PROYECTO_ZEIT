# Implementation Plan: Solicitudes Multi-Item con Trazabilidad

**Branch**: `006-solicitudes-multi-material` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

## Summary

Activar las tablas `material_request_items` y `material_request_audit` que ya existen en la DB pero carecen de código activo. Se extiende el módulo `app/modules/requests/` para soportar solicitudes con múltiples materiales y registro automático de cada cambio de estado. La estrategia es **totalmente aditiva**: las solicitudes legacy (single-item con `related_material_id`) siguen funcionando sin ninguna modificación.

## Technical Context

**Language/Version**: Python 3.11

**Primary Dependencies**: FastAPI · psycopg2 · Pydantic v2

**Storage**: PostgreSQL — tablas `material_requests`, `material_request_items`, `material_request_audit`

**Testing**: pytest · FastAPI TestClient · smoke tests existentes en `tests/smoke/`

**Target Platform**: Linux/Windows server, mismo proceso uvicorn que el resto del ERP

**Project Type**: Web service — extensión de módulo existente

**Performance Goals**: Mismo SLA que el resto del backend (< 500 ms p95 en operaciones normales)

**Constraints**: Sin migraciones nuevas (las tablas ya existen). Sin cambios de API que rompan consumidores existentes. Los 13 smoke tests actuales deben pasar sin modificación.

**Scale/Scope**: Solicitudes con hasta 20 ítems por request. Concurrencia baja-media (ERP interno, < 50 usuarios simultáneos).

## Constitution Check

*GATE: Debe pasar antes de Phase 0. Re-verificar tras Phase 1.*

| Principio | Estado | Justificación |
|-----------|--------|---------------|
| Un solo puerto/proceso | PASS | Sin nuevos servicios. Todo en el proceso FastAPI existente. |
| Un solo sistema de auth | PASS | Se reutilizan `get_current_user` y `require_permission` existentes. |
| Tests no destructivos | PASS | Se añaden smoke tests que no borran datos. |
| Compuerta verify.ps1 | PASS | Se ejecuta al finalizar (import + pytest smoke + npm build). |
| Sin endpoints legacy duplicados | PASS | Se extiende el endpoint existente; no se añaden rutas duplicadas. |

## Project Structure

### Documentation (this feature)

```text
specs/006-solicitudes-multi-material/
├── plan.md              <- este archivo
├── research.md          <- Phase 0
├── data-model.md        <- Phase 1
├── quickstart.md        <- Phase 1
├── contracts/
│   └── api.md           <- Phase 1
└── tasks.md             <- /speckit-tasks
```

### Source Code (repository root)

```text
app/modules/requests/
├── schemas.py     <- actualizar: MaterialRequestItemCreate + MaterialRequestCreate extendido
├── service.py     <- actualizar: create (multi-item), approve/reject (+audit), + get_history
└── router.py      <- añadir: GET /requests/material-requests/{id}/history

tests/smoke/
└── test_endpoints.py    <- añadir smoke tests para multi-item y audit history
```

**Structure Decision**: Extensión del módulo existente. Sin nuevos archivos de módulo. Toda la lógica en los 3 archivos ya presentes.
