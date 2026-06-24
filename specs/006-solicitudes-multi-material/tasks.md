# Tasks: Solicitudes Multi-Item con Trazabilidad

**Input**: Design documents desde `specs/006-solicitudes-multi-material/`

**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Contratos**: [contracts/api.md](contracts/api.md)

**Scope**: Solo backend — 3 archivos a modificar. Sin migraciones (tablas ya existen).

---

## Phase 1: Setup

**Purpose**: Verificar estado previo y dejar la base lista.

- [ ] T001 Verificar que `material_request_items` y `material_request_audit` existen en DB con `SELECT table_name FROM information_schema.tables WHERE table_name IN ('material_request_items','material_request_audit')`
- [ ] T002 Leer el archivo `app/modules/requests/schemas.py` completo para tener la imagen actual antes de modificar
- [ ] T003 Leer el archivo `app/modules/requests/service.py` completo para mapear las 4 funciones existentes antes de modificar
- [ ] T004 Leer el archivo `app/modules/requests/router.py` completo para tener la imagen del router antes de modificar

**Checkpoint**: Conocemos el estado exacto de los 3 archivos que vamos a tocar.

---

## Phase 2: Fundacional (Schemas — bloquea todas las stories)

**Purpose**: Extender los schemas Pydantic para soportar el nuevo modo multi-item. Todo lo demás depende de esto.

**CRÍTICO**: Nada de US1, US2, US3 puede arrancar hasta que los schemas estén listos.

- [ ] T005 Añadir clase `MaterialRequestItemCreate(BaseModel)` en `app/modules/requests/schemas.py` con campos `material_id: UUID` y `quantity: float = Field(..., gt=0)`
- [ ] T006 Modificar `MaterialRequestCreate` en `app/modules/requests/schemas.py` para añadir campo `items: Optional[List[MaterialRequestItemCreate]] = None` (mantener `related_material_id` y `quantity` como Optional para backward compat)
- [ ] T007 [P] Añadir clase `MaterialRequestItemOut(BaseModel)` en `app/modules/requests/schemas.py` con `material_id: UUID`, `material_name: str`, `material_code: str`, `quantity: float`
- [ ] T008 [P] Añadir clase `MaterialRequestAuditOut(BaseModel)` en `app/modules/requests/schemas.py` con `id: UUID`, `action: str`, `old_status: str`, `new_status: Optional[str]`, `actor_name: str`, `source: str`, `created_at: datetime`

**Checkpoint**: Schemas listos. Correr `python -c "from app.modules.requests.schemas import MaterialRequestCreate, MaterialRequestItemCreate, MaterialRequestAuditOut; print('OK')"` — debe imprimir OK.

---

## Phase 3: User Story 1 — Crear solicitud con varios materiales (Priority: P1) — MVP

**Goal**: POST `/requests/material-requests` acepta lista `items`, inserta en `material_request_items`, y los listados devuelven `items` en cada solicitud.

**Independent Test**: Crear solicitud con 2 materiales vía `POST /requests/material-requests` con body `{"items":[...], "reason":"test", "project_id":"..."}` → responde 200 con `{"id":"...","status":"PENDING"}`. Luego `GET /requests/material-requests/my` muestra `"items":[{...},{...}]`.

### Implementación US1

- [ ] T009 [US1] En `app/modules/requests/service.py`, añadir función helper `_insert_items(cur, request_id, items)` que valida duplicados (raise HTTPException 422 si hay material_id repetido), valida que cada material existe en la tabla `materials`, y hace INSERT INTO `material_request_items` por cada ítem
- [ ] T010 [US1] Modificar `create_material_request_service` en `app/modules/requests/service.py` para detectar si `payload.items` tiene contenido (modo multi-item) o si tiene `related_material_id` (modo legacy): en modo multi-item usar `items[0]` como `related_material_id`/`quantity` en `material_requests` y llamar a `_insert_items` dentro de la misma transacción antes del `conn.commit()`
- [ ] T011 [P] [US1] Añadir función `_get_items_for_request(cur, request_id)` en `app/modules/requests/service.py` que hace `SELECT mri.material_id, m.name, m.code, mri.quantity FROM material_request_items mri JOIN materials m ON m.id = mri.material_id WHERE mri.request_id = %s`; si no hay filas en `material_request_items` (solicitud legacy), sintetiza el ítem desde `related_material_id`/`quantity` del propio registro
- [ ] T012 [US1] Actualizar `list_my_material_requests_service` en `app/modules/requests/service.py` para llamar a `_get_items_for_request` por cada solicitud y añadir el campo `items` al dict de respuesta
- [ ] T013 [US1] Actualizar `list_all_material_requests_service` en `app/modules/requests/service.py` para llamar a `_get_items_for_request` por cada solicitud y añadir el campo `items` al dict de respuesta

**Checkpoint**: `GET /requests/material-requests/my` devuelve `items: [...]` en cada solicitud. Solicitudes legacy (sin filas en material_request_items) muestran 1 ítem sintetizado. Smoke tests existentes pasan.

---

## Phase 4: User Story 2 — Trazabilidad de aprobaciones (Priority: P2)

**Goal**: Cada llamada a approve o reject registra automáticamente en `material_request_audit` dentro de la misma transacción. El registro nunca queda desincronizado.

**Independent Test**: Aprobar una solicitud → inmediatamente después `SELECT * FROM material_request_audit WHERE material_request_id = '<id>'` devuelve 1 fila con `action='APPROVED'`, `old_status='PENDING'`, `new_status='APPROVED'`, `actor_id = <uuid del aprobador>`.

### Implementación US2

- [ ] T014 [US2] Añadir función helper `_record_audit(cur, request_id, action, old_status, new_status, actor_id)` en `app/modules/requests/service.py` que hace `INSERT INTO material_request_audit (id, material_request_id, action, old_status, new_status, actor_id, source, created_at) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, 'API', NOW())`
- [ ] T015 [US2] En `approve_material_request_service` en `app/modules/requests/service.py`, añadir llamada a `_record_audit(cur, request_id, 'APPROVED', old_status, 'APPROVED', current_user["id"])` ANTES del `conn.commit()` (dentro del mismo bloque `with db_connection()`)
- [ ] T016 [US2] En `reject_material_request_service` en `app/modules/requests/service.py`, añadir llamada a `_record_audit(cur, request_id, 'REJECTED', old_status, 'REJECTED', user["id"])` ANTES del `conn.commit()` (dentro del mismo bloque `with db_connection()`); asegurarse de que `old_status` se lee del SELECT FOR UPDATE existente

**Checkpoint**: Aprobar una solicitud → fila en `material_request_audit`. Rechazar → fila en `material_request_audit`. Si el INSERT de audit falla (simular con SQL inválido) → el UPDATE de status hace rollback automático (por no haber commit).

---

## Phase 5: User Story 3 — Consultar historial de auditoría (Priority: P3)

**Goal**: `GET /requests/material-requests/{id}/history` devuelve la lista cronológica de todos los cambios de estado de una solicitud.

**Independent Test**: Después de aprobar (US2), `GET /requests/material-requests/{request_id}/history` con token de admin devuelve `[{"action":"APPROVED","old_status":"PENDING","new_status":"APPROVED","actor_name":"admin",...}]`.

### Implementación US3

- [ ] T017 [US3] Añadir función `get_request_history_service(request_id, current_user)` en `app/modules/requests/service.py` que: (1) verifica que la solicitud existe (SELECT id, requested_by FROM material_requests WHERE id = %s), (2) verifica permisos (el propio solicitante O usuario con `logistics:stock:move` en sus permisos — usar `current_user["permissions"]`), (3) hace `SELECT a.id, a.action, a.old_status, a.new_status, u.username AS actor_name, a.source, a.created_at FROM material_request_audit a LEFT JOIN users u ON u.id = a.actor_id WHERE a.material_request_id = %s ORDER BY a.created_at ASC` y devuelve lista de dicts
- [ ] T018 [US3] Añadir import de `get_request_history_service` en `app/modules/requests/router.py`
- [ ] T019 [US3] Añadir endpoint en `app/modules/requests/router.py`: `@router.get("/material-requests/{request_id}/history")` con `current_user=Depends(get_current_user)` que llama a `get_request_history_service(request_id, current_user)` y devuelve la lista

**Checkpoint**: `GET /requests/material-requests/{id}/history` con token válido devuelve lista de auditoría. Con solicitud inexistente → 404. Con usuario sin permisos ajenos → 403.

---

## Phase 6: Polish y Smoke Tests

**Purpose**: Asegurar que la feature queda protegida por tests automáticos y la compuerta pasa.

- [ ] T020 Añadir test `test_material_request_multi_item` en `tests/smoke/test_endpoints.py`: crea solicitud con 2 materiales, verifica respuesta 200, verifica que `GET /requests/material-requests/my` devuelve esa solicitud con `items` de longitud 2
- [ ] T021 Añadir test `test_material_request_audit_history` en `tests/smoke/test_endpoints.py`: crea solicitud con 1 ítem, la aprueba con admin_auth, llama a `GET /requests/material-requests/{id}/history`, verifica que hay 1 evento con `action == "APPROVED"`. Test no destructivo: no elimina solicitudes de prueba pero usa reason con timestamp para no interferir con datos reales
- [ ] T022 Añadir test `test_material_request_duplicado_rechazado` en `tests/smoke/test_endpoints.py`: intenta crear solicitud con mismo material_id dos veces, verifica que devuelve 422
- [ ] T023 Añadir test `test_material_request_legacy_compat` en `tests/smoke/test_endpoints.py`: crea solicitud con modo legacy (`related_material_id` + `quantity`) y verifica que sigue funcionando (200, status PENDING)
- [ ] T024 Ejecutar compuerta completa `.\verify.ps1` desde la raíz del proyecto y confirmar que los 3 pasos pasan (import backend + pytest smoke + npm build)
- [ ] T025 Hacer commit: `git add app/modules/requests/ tests/smoke/test_endpoints.py && git commit -m "feat: solicitudes multi-item y audit trail (feature 006)"`

---

## Dependencies & Execution Order

### Dependencias entre fases

- **Phase 1 (Setup)**: Sin dependencias — empezar aquí siempre
- **Phase 2 (Schemas)**: Depende de Phase 1 — BLOQUEA todo lo demás
- **Phase 3 (US1)**: Depende de Phase 2
- **Phase 4 (US2)**: Depende de Phase 2 — INDEPENDIENTE de Phase 3 (usa helper distinto)
- **Phase 5 (US3)**: Depende de Phase 4 (necesita datos de audit para probar)
- **Phase 6 (Polish)**: Depende de Phases 3, 4 y 5

### Dependencias dentro de cada fase

**Phase 3:**
- T009 (helper `_insert_items`) → T010 (usar el helper en create)
- T011 (helper `_get_items`) → T012, T013 (usar en listados) — T011 es [P] respecto a T009/T010

**Phase 4:**
- T014 (helper `_record_audit`) → T015, T016 (usar en approve/reject) — T015 y T016 son [P] entre sí

**Phase 5:**
- T017 (service) → T018 (import) → T019 (endpoint) — secuencial

### Paralelismo posible

- T007 y T008 (schemas de salida) son [P] respecto a T005/T006 — se pueden hacer en paralelo
- T011 (helper get_items) es [P] respecto a T009/T010 — archivos distintos no, pero lógica separada
- T015 y T016 (audit en approve y reject) son [P] — son funciones independientes en service.py

---

## Parallel Example: Phase 2 (Schemas)

```text
# Estos 4 tasks se pueden redactar en paralelo porque son clases independientes:
T005: Añadir MaterialRequestItemCreate
T006: Modificar MaterialRequestCreate
T007: Añadir MaterialRequestItemOut
T008: Añadir MaterialRequestAuditOut
```

---

## Implementation Strategy

### MVP (solo US1)

1. Completar Phase 1 (verificación)
2. Completar Phase 2 (schemas)
3. Completar Phase 3 (US1 — multi-item create + listados con items)
4. **VALIDAR**: crear solicitud multi-item, verificar items en GET
5. Commit y demo

### Entrega incremental

1. Phase 1 + 2 → schemas listos
2. Phase 3 → multi-item funcionando → validar → demo
3. Phase 4 → audit trail en approve/reject → validar
4. Phase 5 → endpoint de historial → validar
5. Phase 6 → smoke tests + compuerta → commit final

---

## Notes

- `[P]` = archivo/función distinta, sin dependencia de tarea anterior incompleta
- Todas las funciones nuevas en `service.py` van como funciones top-level, no como métodos de clase
- El helper `_insert_items` y `_record_audit` llevan prefijo `_` (privados al módulo, no se exportan)
- Modo legacy sigue funcionando: si `payload.items` es None/vacío y `payload.related_material_id` existe → usar ruta antigua
- Nunca usar `conn.commit()` dentro de `_insert_items` o `_record_audit` — el commit lo hace la función llamadora
