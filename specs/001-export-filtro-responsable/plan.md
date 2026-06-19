# Implementation Plan: Filtrar el Exportar de Planificación por responsable

**Branch**: `001-export-filtro-responsable` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-export-filtro-responsable/spec.md`

## Summary

Agregar un filtro **por responsable** al Exportar de Planificación, sumándose a los filtros actuales (fecha, prioridad, estado, cliente). El export ya carga todas las actividades y filtra en Python; añadimos una condición más con la **misma semántica que ya usa el tablero**: una tarea coincide si el id de la persona está en `responsables_ids` (multi) **o** es su `responsable_id`. Selección de **un responsable a la vez** (confirmado en clarify) más una opción **"sin responsable asignado"** (sentinela `__none__`). No requiere migración ni cambios de esquema.

## Technical Context

**Language/Version**: Python 3.11 (backend) · JavaScript ES2020 + React 18 (frontend)

**Primary Dependencies**: FastAPI, psycopg2 (SQL crudo), openpyxl (generación del Excel) · React + Vite + TailwindCSS

**Storage**: PostgreSQL — tabla `planificacion_semanal`, columnas `responsable_id` (uuid → `users.id`) y `responsables_ids` (texto, lista de uuids separada por comas, migración 032)

**Testing**: pytest (`tests/smoke`) + `npm run build` (frontend), orquestados por `verify.ps1`

**Target Platform**: Servidor web (uvicorn 127.0.0.1:8000) + SPA en navegador

**Project Type**: Aplicación web (backend FastAPI + frontend React)

**Performance Goals**: N/A — el tablero semanal maneja decenas/cientos de filas; el filtrado en memoria es trivial

**Constraints**: Cero regresión al export actual (sin responsable → comportamiento idéntico). Reutilizar el formato y columnas del Excel existente y la lista de usuarios que ya alimenta el filtro de columna del tablero.

**Scale/Scope**: 1 endpoint (nuevo parámetro), 1 servicio, 1 vista React (modal de export), 1 smoke test.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Artículo | Cumplimiento |
|---|---|
| **1. SQL solo en service.py** | ✅ El router solo declara el nuevo `Query` y delega; el filtrado vive en `service.py`. |
| **5. Compuerta verde + smoke test nuevo** | ✅ Se agrega un smoke test para `?responsable=<id>` y `?responsable=__none__`; nada se cierra sin `verify.ps1` verde. |
| **6. Esquema real + nulos defensivos** | ✅ Columnas verificadas (`responsable_id`, `responsables_ids`). El filtro guarda contra `None` con `(x or "")` antes de `.split(",")`. |
| **7. Orden de rutas / SDD** | ✅ No hay ruta nueva; `/actividades/export` ya está declarada antes de `/actividades/{id}`. Sin riesgo de captura. |
| **Frontend (paleta, inline styles, formatUsername)** | ✅ El nuevo `<select>` reutiliza el patrón del modal existente y `formatUsername(u.username)` como el filtro de columna. |

**Resultado**: Sin violaciones. No se requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-export-filtro-responsable/
├── plan.md              # Este archivo
├── research.md          # Decisiones de diseño (Phase 0)
├── data-model.md        # Datos y regla de coincidencia (Phase 1)
├── quickstart.md        # Guía de validación (Phase 1)
├── contracts/
│   └── export-actividades.md   # Contrato del endpoint (Phase 1)
└── tasks.md             # (lo genera /speckit-tasks, no este comando)
```

### Source Code (repository root) — archivos que se tocan

```text
app/modules/planificacion/
├── router.py     # + parámetro Query "responsable" en export_actividades, se pasa al service
└── service.py    # + parámetro "responsable" en export_planificacion_excel_service + lógica de filtro

frontend/myapp/src/pages/admin/
└── AdminPlanificacion.jsx
    ├── estado exportFilters         # + campo responsable: ""
    ├── apertura del modal de export # + seed responsable: colFilters.responsable
    ├── buildExportParams()          # + p.set("responsable", cfg.responsable)
    └── modal de export (JSX)        # + <select> de responsables (lista `users`) + opción "Sin responsable asignado"

tests/smoke/
└── test_endpoints.py   # + test export con ?responsable=<id> y ?responsable=__none__ (200 + xlsx)
```

**Structure Decision**: Aplicación web ya existente. La feature es un *enhancement* incremental sobre 3 archivos de producto (router, service, vista) + 1 de pruebas. No se crean módulos ni migraciones nuevos.

## Complexity Tracking

> No aplica — Constitution Check sin violaciones.
