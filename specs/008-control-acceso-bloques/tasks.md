---
description: "Task list for feature 008-control-acceso-bloques"
---

# Tasks: Control de Acceso por Bloques (Superadmin)

**Input**: Design documents from `specs/008-control-acceso-bloques/`

**Prerequisites**: plan.md ✅ · spec.md ✅ · research.md ✅ · data-model.md ✅ · contracts/api.md ✅

**Tests**: Smoke tests incluidos en Polish (T029) por ser endpoints nuevos — no se requiere TDD explícito.

**Organization**: Tareas agrupadas por historia de usuario para implementación y prueba independiente.

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: Historia de usuario a la que pertenece (US1, US2, US3)
- Rutas relativas a la raíz del repo

---

## Phase 1: Setup (Infraestructura base)

**Purpose**: Crear archivos nuevos que no tienen dependencias entre sí.

- [X] T001 Crear `migrations/040_user_block_permissions.sql` con la DDL exacta del data-model.md (tabla user_block_permissions con CHECK en block_slug e index en user_id)
- [X] T002 [P] Crear `app/core/blocks.py` con constantes `VALID_BLOCKS = ['logistica','operaciones','administracion','gerencia']`, `VALID_LEVELS = ['view','edit']` y `BLOCK_TO_MODULES = {'logistica':['logistics'],'operaciones':['operations'],'administracion':['admin','administracion'],'gerencia':['gerente']}`
- [X] T003 [P] Crear `frontend/myapp/src/constants/blocks.js` con array `BLOCKS = [{slug, label, modules}]` para los 4 bloques y objeto `BLOCK_TO_MODULES` espejo del backend

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Infraestructura que TODAS las historias necesitan. No puede empezar ninguna historia hasta completar esta fase.

**⚠️ CRÍTICO**: Ninguna historia puede empezar hasta que esta fase esté completa.

- [X] T004 Aplicar migración ejecutando `python run_migrations.py` desde la raíz y verificar que `user_block_permissions` existe en la DB
- [X] T005 Añadir función `get_user_blocks(user_id: str) -> list[dict]` en `app/core/security/auth.py` que ejecute `SELECT block_slug, level FROM user_block_permissions WHERE user_id = %s` y retorne `[{"slug": ..., "level": ...}]`; retornar `[]` si no hay filas (nunca lanzar excepción)
- [X] T006 [P] Añadir schemas en `app/modules/superadmin/schemas.py`: `BlockAssignment(slug, level)`, `UserBlocksUpdate(blocks: list[BlockAssignment])`, `UserBlockDetail(slug, level, granted_at)`, `UserBlocksDetailOut(user_id, username, blocks: list[UserBlockDetail])`, `UserWithBlocksOut(id, username, email, is_active, blocks: list[BlockAssignment])`
- [X] T007 Corregir detección de superadmin en `frontend/myapp/src/hooks/useAuth.js`: añadir `const isSuperadmin = payload.role === "superadmin"` y modificar `const isAdmin = isSuperadmin || permissions.some(p => p.startsWith("admin:"))` para que superadmin pase todos los `ProtectedRoute requirePermission="admin:"` existentes

**Checkpoint**: DB lista + función get_user_blocks() + schemas + superadmin detectado → historias pueden comenzar en paralelo.

---

## Phase 3: User Story 1 — Ghost Button Fix (Priority: P1) 🎯 MVP

**Goal**: Eliminar definitivamente el patrón "botón visible → acceso denegado". Los módulos que el usuario no tiene asignados desaparecen del DOM.

**Independent Test**: Usar quickstart.md Escenario 1 — login con usuario sin bloques, verificar sidebar vacío y mensaje "No tienes módulos asignados".

### Implementation for User Story 1

- [X] T008 [US1] Extender `authenticate_user()` en `app/core/security/auth.py`: llamar `get_user_blocks(user_id)` e incluir `"blocks"` en el dict retornado; para superadmin devolver `"blocks": "all"` (string literal)
- [X] T009 [US1] Extender `create_access_token()` en `app/core/security/auth.py`: añadir parámetro `blocks: list | str | None = None` e incluirlo en el JWT payload como campo `"blocks"`
- [X] T010 [US1] Extender `rotate_refresh_token()` en `app/core/security/auth.py`: llamar `get_user_blocks(user_id)` para el nuevo JWT igual que en login
- [X] T011 [US1] Extender response del `POST /auth/login` en `app/core/security/router.py`: pasar `blocks=user_data["blocks"]` a `create_access_token()` y añadir campo `"blocks"` en el JSON de respuesta
- [X] T012 [US1] Extender response del `POST /auth/refresh` en `app/core/security/router.py`: incluir campo `"blocks"` en la respuesta de renovación de token
- [X] T013 [US1] Actualizar `frontend/myapp/src/pages/Login.jsx`: tras login exitoso, leer `data.blocks` de la respuesta y guardar `localStorage.setItem("blocks", JSON.stringify(data.blocks ?? []))`; también limpiar `"blocks"` en el `localStorage.clear()` de logout
- [X] T014 [US1] Actualizar `frontend/myapp/src/hooks/useAuth.js`: leer `blocks` de localStorage con fallback a `payload.blocks`; exponer `auth.blocks` como array (o `"all"` para superadmin); añadir método `canEditBlock: (slug) => isSuperadmin || (blocks || []).find(b => b.slug === slug)?.level === "edit"`
- [X] T015 [US1] Corregir `visibleModules` en `frontend/myapp/src/components/Layout.jsx` línea ~419: importar `BLOCK_TO_MODULES` de `../constants/blocks`; reemplazar el filtro actual por `auth.role === "superadmin" ? MODULES : MODULES.filter(m => (auth.blocks || []).some(b => BLOCK_TO_MODULES[b.slug]?.includes(m.key)))`
- [X] T016 [US1] Añadir estado "sin bloques" en `frontend/myapp/src/components/Layout.jsx`: cuando `visibleModules.length === 0` y `auth.role !== "superadmin"`, el área de módulos del sidebar muestra texto "Sin módulos asignados — contacta al TI" y la sección `activeModule` cae al default sin crash

**Checkpoint**: En este punto US1 es completamente funcional. Iniciar sesión con un usuario sin bloques muestra sidebar vacío con mensaje. Los módulos visibles corresponden exactamente a los bloques asignados.

---

## Phase 4: User Story 2 — Superadmin Asigna Bloques (Priority: P2)

**Goal**: El TI tiene una UI donde puede ver, asignar y revocar bloques a cualquier usuario con nivel view/edit.

**Independent Test**: Usar quickstart.md Escenarios 2 y 3 — superadmin asigna bloques via UI, usuario afectado los ve en su próxima carga.

### Implementation for User Story 2

- [X] T017 [P] [US2] Implementar `get_users_with_blocks_service()` en `app/modules/superadmin/service.py`: SELECT de tabla `users` JOIN LEFT con `user_block_permissions`; retornar lista con campos `id, username, email, is_active` más lista de `{slug, level}` para cada usuario
- [X] T018 [P] [US2] Implementar `get_user_blocks_by_id_service(user_id)` en `app/modules/superadmin/service.py`: retornar siempre los 4 bloques con `level=None` para los no asignados (formato del contrato contracts/api.md)
- [X] T019 [P] [US2] Implementar `set_user_blocks_service(user_id, blocks, granted_by)` en `app/modules/superadmin/service.py`: DELETE todas las filas del usuario + INSERT las nuevas en una transacción; validar que `block_slug in VALID_BLOCKS` y `level in VALID_LEVELS` importando desde `app.core.blocks`
- [X] T020 [US2] Añadir `GET /superadmin/users` en `app/modules/superadmin/router.py` con respuesta `List[UserWithBlocksOut]` y dependencia `require_superadmin` (usa T017)
- [X] T021 [US2] Añadir `GET /superadmin/users/{user_id}/blocks` en `app/modules/superadmin/router.py` con respuesta `UserBlocksDetailOut` y dependencia `require_superadmin` (usa T018)
- [X] T022 [US2] Añadir `PUT /superadmin/users/{user_id}/blocks` en `app/modules/superadmin/router.py` con body `UserBlocksUpdate`, respuesta `UserBlocksDetailOut` y dependencia `require_superadmin`; lanzar `HTTPException(422)` si slugs o levels inválidos (usa T019)
- [X] T023 [US2] Crear `frontend/myapp/src/pages/admin/SuperadminUserBlocks.jsx`: página que lista todos los usuarios (GET /superadmin/users), muestra una tabla con nombre/email/estado/bloques; al hacer clic en un usuario muestra un panel lateral o modal con los 4 bloques toggleables (sin asignar / ver / editar); botón "Guardar" llama PUT /superadmin/users/{id}/blocks; usar tokens `var(--primary)`, `var(--accent)` para colores — no hex literales
- [X] T024 [US2] Añadir ruta en `frontend/myapp/src/App.jsx`: importar `SuperadminUserBlocks` y añadir `<Route path="/superadmin/users" element={<ProtectedRoute requirePermission="admin:"><SuperadminUserBlocks /></ProtectedRoute>} />`
- [X] T025 [US2] Añadir enlace/botón "Gestionar Bloques de Acceso" en `frontend/myapp/src/pages/admin/AdminUsers.jsx` visible únicamente cuando `auth.role === "superadmin"`; el botón navega a `/superadmin/users`

**Checkpoint**: En este punto US1 + US2 funcionan independientemente. El TI puede gestionar bloques desde la UI y el efecto se refleja al recargar del usuario afectado.

---

## Phase 5: User Story 3 — Vista Rápida de Bloques en Lista (Priority: P3)

**Goal**: El TI ve los bloques de todos los usuarios en la tabla de SuperadminUserBlocks sin abrir cada perfil.

**Independent Test**: Usar quickstart.md Escenario 4 — la lista de usuarios muestra chips de bloques y badge "Sin acceso" para quienes no tienen ninguno.

### Implementation for User Story 3

- [X] T026 [US3] Añadir columna "Bloques" en la tabla de usuarios de `SuperadminUserBlocks.jsx`: por cada usuario mostrar chips compactos con `{slug_label} · {level_label}` (ej. "Logística · Editar"); los chips usan `var(--primary)` para edit y `var(--primary-soft)` para view
- [X] T027 [P] [US3] Añadir badge "Sin acceso" (color de advertencia `#EAB308`) en la columna de bloques para usuarios que tengan `blocks: []`; el badge es claramente diferenciable de los chips normales

**Checkpoint**: Las tres historias funcionan de forma independiente y conjunta.

---

## Phase Final: Polish & Cross-Cutting

**Purpose**: Mejoras transversales que afectan a múltiples historias.

- [X] T028 [P] Extender `GET /auth/me` en `app/core/security/router.py`: incluir campo `"blocks"` en la respuesta llamando `get_user_blocks(user_data["id"])` (para superadmin retornar `"blocks": "all"`)
- [X] T029 [P] Crear `tests/smoke/test_superadmin_blocks.py` con smoke tests: (1) superadmin autentica y GET /superadmin/users retorna 200 con campo `blocks`; (2) PUT /superadmin/users/{test_user_id}/blocks con bloques válidos retorna 200; (3) PUT con slug inválido retorna 422; patrón save → test → restore para no dejar datos de test en producción
- [X] T030 Ejecutar `verify.ps1` desde la raíz del repo y confirmar: (1) `python -c "import app.main"` pasa, (2) `pytest tests/smoke` pasa incluyendo T029, (3) `npm run build` compila sin errores

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — puede empezar inmediatamente. T002 y T003 en paralelo con T001.
- **Foundational (Phase 2)**: Depende de Phase 1. T004 depende de T001 (necesita el archivo SQL). T005 puede correr en paralelo con T006 y T007 una vez aplicada la migración.
- **US1 (Phase 3)**: Depende de Phase 2 completa. Internamente: T008 primero (extend authenticate_user), luego T009-T010 (extend JWT functions), luego T011-T012 (extend responses), luego T013-T016 (frontend en orden).
- **US2 (Phase 4)**: Depende de Phase 2 + T007. T017/T018/T019 en paralelo. T020/T021/T022 dependen de sus respectivos services. T023 depende de T022. T024 depende de T023. T025 depende de T024.
- **US3 (Phase 5)**: Depende de T023 (SuperadminUserBlocks.jsx ya existente). T026 y T027 en paralelo.
- **Polish**: Depende de todas las fases anteriores.

### User Story Dependencies

- **US1 (P1)**: Sin dependencias entre historias — puede completarse solo con Phase 2
- **US2 (P2)**: Sin dependencias de US1 — puede desarrollarse en paralelo con US1 (comparten Phase 2)
- **US3 (P3)**: Depende de US2 (extiende SuperadminUserBlocks.jsx)

### Within Each User Story

- Backend services antes de routers
- Routers antes de frontend
- Frontend: constantes → hooks → componentes → rutas

### Parallel Opportunities

```bash
# Phase 1 — todo en paralelo:
T001: crear migrations/040_user_block_permissions.sql
T002: crear app/core/blocks.py
T003: crear frontend/myapp/src/constants/blocks.js

# Phase 2 — T004 primero, luego T005/T006/T007 en paralelo:
T005: get_user_blocks() en auth.py
T006: schemas en superadmin/schemas.py
T007: fix isAdmin en useAuth.js

# Phase 4 — services en paralelo:
T017: get_users_with_blocks_service()
T018: get_user_blocks_by_id_service()
T019: set_user_blocks_service()
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup (T001-T003)
2. Phase 2: Foundational (T004-T007)
3. Phase 3: US1 — Ghost Button Fix (T008-T016)
4. **STOP y VALIDAR**: Escenario 1 del quickstart.md
5. Deploy si listo — el bug de ghost buttons está resuelto

### Incremental Delivery

1. Setup + Foundational → base lista
2. US1 → ghost buttons resueltos → demo/deploy
3. US2 → superadmin puede gestionar bloques → demo/deploy
4. US3 → vista rápida en lista → demo/deploy
5. Polish → smoke tests + `/auth/me` extendido

### Parallel Team Strategy

Con dos desarrolladores:
1. Ambos completan Setup + Foundational juntos
2. Dev A: US1 (frontend-heavy) — T008 a T016
3. Dev B: US2 backend (T017 a T022) mientras Dev A hace frontend
4. Dev A y Dev B: US2 frontend (T023-T025) + US3 (T026-T027)

---

## Notes

- `[P]` = archivos distintos, sin dependencias incompletas — lanzar en paralelo
- `[Story]` mapea la tarea a la historia exacta para trazabilidad
- El fix de ghost buttons (T015) es una sola línea de cambio en Layout.jsx pero requiere las fases 1 y 2 completas para tener datos reales
- El bug `isAdmin` (T007) es foundational: sin él, el superadmin no puede acceder a ninguna ruta `requirePermission="admin:"` en el frontend
- Usar siempre `var(--primary)`, `var(--accent)` en el nuevo componente — no hex literales (Constitución Art. 2)
- Validar con `verify.ps1` antes de mergear a main (Constitución Art. 5)
