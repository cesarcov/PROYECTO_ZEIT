---
description: "Task list — Filtro por responsable en el export de Planificación"
---

# Tasks: Filtrar el Exportar de Planificación por responsable

**Input**: Design documents from `specs/001-export-filtro-responsable/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUIDOS — el Artículo 5 de la constitución exige un smoke test por endpoint nuevo/modificado. Se escriben antes de la implementación (deben fallar primero).

**Organization**: Tareas agrupadas por historia de usuario (US1 P1, US2 P2, US3 P3). Las tres tocan los mismos 3 archivos, así que las historias se entregan de forma incremental, no en paralelo por personas.

## Format: `[ID] [P?] [Story] Descripción con ruta de archivo`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1/US2/US3)

---

## Phase 1: Setup

**Purpose**: punto de partida verificable.

- [X] T001 Confirmar rama `001-export-filtro-responsable` activa y correr `.\verify.ps1` para registrar el baseline verde (backend importa + smoke tests + build) antes de tocar nada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el "cableado" del parámetro `responsable` que TODAS las historias necesitan (sin lógica de filtro todavía).

**⚠️ CRITICAL**: ninguna historia puede completarse hasta terminar esta fase.

- [X] T002 Backend: agregar `responsable: Optional[str] = Query(None)` al handler `export_actividades` y pasarlo a `service.export_planificacion_excel_service(...)` en `app/modules/planificacion/router.py`.
- [X] T003 Backend: agregar el parámetro `responsable: str = None` a la firma de `export_planificacion_excel_service` en `app/modules/planificacion/service.py` (aún sin filtrar; no rompe el comportamiento actual).
- [X] T004 [P] Frontend: en `frontend/myapp/src/pages/admin/AdminPlanificacion.jsx`, agregar `responsable: ""` al estado inicial `exportFilters`, sembrar `responsable: colFilters.responsable` al abrir el modal de export, y añadir `if (cfg.responsable) p.set("responsable", cfg.responsable)` en `buildExportParams`.

**Checkpoint**: el endpoint y la UI ya transportan `responsable` de punta a punta, sin cambiar resultados (todavía).

---

## Phase 3: User Story 1 - Exportar solo las tareas de un responsable (Priority: P1) 🎯 MVP

**Goal**: elegir una persona y obtener en el Excel solo sus tareas.

**Independent Test**: con tareas de varias personas, filtrar por "X" y verificar que el Excel solo trae filas de X.

### Tests (escribir primero, deben fallar)

- [X] T005 [US1] Smoke test en `tests/smoke/test_endpoints.py`: `GET /planificacion/actividades/export?responsable=<id real>` responde 200 y `Content-Type` de xlsx.

### Implementation

- [X] T006 [US1] Backend: en `export_planificacion_excel_service` (`app/modules/planificacion/service.py`), dentro del bucle de filtrado, excluir la actividad si `responsable` tiene valor (≠ `__none__`) y ese id NO está en `responsables_ids` ni es `responsable_id`. Usar guarda de nulos: `[x.strip() for x in (a.get("responsables_ids") or "").split(",") if x.strip()]`. (Cubre también la coincidencia multi-responsable de US2.)
- [X] T007 [P] [US1] Frontend: agregar un `<select>` "Responsable" en el modal de export (`AdminPlanificacion.jsx`), con opción "Todos" (value `""`) + `users.map(u => <option value={u.id}>{formatUsername(u.username)}</option>)`, enlazado a `exportFilters.responsable`.

**Checkpoint**: US1 funcional y testeable. MVP entregable.

---

## Phase 4: User Story 2 - Tareas con varios responsables (Priority: P2)

**Goal**: una tarea con varios responsables aparece si la persona buscada es uno de ellos.

**Independent Test**: tarea asignada a X e Y; filtrar por Y → aparece; filtrar por Z (no asignada) → no aparece.

> La implementación ya quedó cubierta por T006 (la coincidencia usa `responsables_ids`, la lista multi). Esta fase la **valida**.

### Tests

- [X] T008 [US2] Smoke/regresión en `tests/smoke/test_endpoints.py`: confirmar que el filtro contempla `responsables_ids` (no solo `responsable_id`) — exportar por el id de un co-responsable devuelve 200 y, sobre datos de prueba, incluye la tarea compartida.

**Checkpoint**: US1 y US2 funcionan de forma independiente.

---

## Phase 5: User Story 3 - Detectar tareas sin responsable asignado (Priority: P3)

**Goal**: opción "sin responsable asignado" que exporta solo las tareas sin nadie.

**Independent Test**: con tareas asignadas y sin asignar, elegir "Sin responsable asignado" → solo las no asignadas.

### Tests

- [X] T009 [US3] Smoke test en `tests/smoke/test_endpoints.py`: `GET /planificacion/actividades/export?responsable=__none__` responde 200 y xlsx.

### Implementation

- [X] T010 [US3] Backend: en `export_planificacion_excel_service` (`service.py`), añadir la rama `responsable == "__none__"` → excluir la actividad si tiene algún responsable (`responsables_ids` no vacío o `responsable_id` presente).
- [X] T011 [P] [US3] Frontend: agregar la opción `<option value="__none__">Sin responsable asignado</option>` al `<select>` de responsable en `AdminPlanificacion.jsx`.

**Checkpoint**: las tres historias funcionan de forma independiente.

---

## Phase 6: Polish & Cross-Cutting

- [X] T012 Ejecutar manualmente los escenarios E1–E6 de `specs/001-export-filtro-responsable/quickstart.md` (incluye sin-filtro = sin regresión, combinación de filtros, y sin coincidencias = xlsx vacío válido). **← Validado por el usuario (GATE 4, 2026-06-19).**
- [X] T013 Correr `.\verify.ps1` y confirmar **TODO VERDE** (compuerta obligatoria antes de cerrar).
- [X] T014 [P] Actualizar `docs/ESTADO_ACTUAL.md` anotando el nuevo filtro por responsable en el export de Planificación.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias.
- **Foundational (T002–T004)**: tras Setup. **Bloquea** las historias. Orden interno: T003 antes de T002 (el router llama al parámetro del service); T004 es independiente.
- **US1 (T005–T007)**: tras Foundational. Es el MVP.
- **US2 (T008)**: tras T006 (su lógica ya quedó incluida ahí).
- **US3 (T009–T011)**: tras Foundational; independiente de US1/US2.
- **Polish (T012–T014)**: tras las historias deseadas.

### Within Each Story

- El test (T005/T008/T009) se escribe antes y debe fallar.
- Backend (service) y Frontend (select) son archivos distintos → pueden ir en paralelo.

### Parallel Opportunities

- T004 [P] (frontend) en paralelo con T002/T003 (backend).
- T006 (service) y T007 [P] (frontend) en paralelo dentro de US1.
- T010 (service) y T011 [P] (frontend) en paralelo dentro de US3.
- T013/T014 al final; T014 [P].

---

## Implementation Strategy

### MVP First (US1)

1. T001 (baseline verde).
2. T002–T004 (cableado del parámetro).
3. T005–T007 (filtrar por una persona).
4. **PARAR y VALIDAR**: probar US1 sola.

### Incremental

- US1 → validar (MVP). → US2 (validación multi-responsable). → US3 (sin asignar). → Polish.
- Cada historia agrega valor sin romper la anterior.

---

## Notes

- Las 3 historias tocan los mismos archivos (`router.py`, `service.py`, `AdminPlanificacion.jsx`); la coincidencia multi-responsable (US2) queda cubierta por el backend de US1.
- `[P]` = archivos distintos, sin dependencias pendientes.
- Verificar que los tests fallen antes de implementar.
- Commit tras cada tarea o grupo lógico, siempre con la compuerta en verde.
- Sin migraciones ni cambios de esquema.

## Total

**14 tareas** · Setup 1 · Foundational 3 · US1 3 · US2 1 · US3 3 · Polish 3.
