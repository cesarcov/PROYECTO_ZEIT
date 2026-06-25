# Tasks: Arquitectura Multi-Tenant (DB por Cliente)

**Input**: Design documents from `specs/007-multi-tenant/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/api.md](contracts/api.md)

**Tests**: Incluidos como smoke tests en los pasos de cada user story (no TDD explícito — los escenarios de validación están en [quickstart.md](quickstart.md)).

**Organization**: Fases por user story para entrega incremental independiente.

## Format: `[ID] [P?] [Story?] Description — file path`

- **[P]**: Puede ejecutarse en paralelo (archivos distintos, sin dependencias incompletas)
- **[Story]**: User story de spec.md a la que pertenece (US1/US2/US3)

---

## Phase 1: Setup (Prerequisitos de infraestructura)

**Purpose**: Crear la master DB y preparar el entorno antes de tocar código del API.

- [X] T001 Crear migrations/038_create_master_db.sql con CREATE TABLE tenants (campos: id, name, slug, db_name, db_url, is_active, provision_status, provision_error, created_at) — ver data-model.md para schema completo
- [X] T002 Ejecutar migrations/038_create_master_db.sql manualmente contra la base de datos erp_master: `psql -U postgres erp_master -f migrations/038_create_master_db.sql`
- [X] T003 Añadir al archivo .env las tres nuevas variables: MASTER_DATABASE_URL (URL a erp_master), SUPERADMIN_USERNAME (ej. "superadmin"), SUPERADMIN_PASSWORD_HASH (bcrypt hash generado con `python -c "from bcrypt import hashpw, gensalt; print(hashpw(b'tu_pass', gensalt()).decode())"`)

---

## Phase 2: Foundational (Infraestructura Core Multi-Tenant)

**Purpose**: Implementar el mecanismo de routing por ContextVar. BLOQUEA todas las user stories.

**⚠️ CRÍTICO**: Las user stories no pueden comenzar hasta completar esta fase.

- [X] T004 [P] Crear app/core/tenant_context.py con: `_tenant_db_url = ContextVar('_tenant_db_url', default=None)`, función `set_tenant_db(url: str)`, función `get_tenant_db() -> Optional[str]`
- [X] T005 [P] Crear app/core/master_db.py con función `master_db_connection()` que conecta a `settings.MASTER_DATABASE_URL` (fallback a `settings.DATABASE_URL` si MASTER_DATABASE_URL está vacío) — reutilizar `_parse_db_url` de database.py
- [X] T006 Modificar app/core/config.py: añadir campos `MASTER_DATABASE_URL: str = ""`, `SUPERADMIN_USERNAME: str = ""`, `SUPERADMIN_PASSWORD_HASH: str = ""`; cambiar `extra = "forbid"` → `extra = "ignore"` para permitir variables de entorno adicionales sin error
- [X] T007 Modificar app/core/database.py: importar `get_tenant_db` de `app.core.tenant_context`; al inicio de `db_connection()` leer `tenant_url = get_tenant_db()` y usar `tenant_url if tenant_url else settings.DATABASE_URL` como URL de conexión (resto del código sin cambios)
- [X] T008 Crear app/core/tenant_middleware.py con clase `TenantMiddleware(BaseHTTPMiddleware)`: leer `X-Tenant-ID` del header; si ausente → `await call_next(request)` directo (fallback dev); si presente → consultar tabla `tenants` en master DB por slug; si no existe → JSONResponse 404 `{"detail": "Empresa '{slug}' no encontrada."}`; si `is_active = False` → JSONResponse 503 `{"detail": "La empresa '{slug}' está temporalmente suspendida. Contacta al administrador."}`; si OK → llamar `set_tenant_db(db_url)` → `await call_next(request)`
- [X] T009 Modificar app/main.py: importar `TenantMiddleware` de `app.core.tenant_middleware`; añadirlo al stack de middlewares entre SecurityHeaders y SlowAPI (`app.add_middleware(TenantMiddleware)` después de `app.add_middleware(SecurityHeadersMiddleware)`); añadir `"X-Tenant-ID"` a la lista `allow_headers` del CORSMiddleware

**Checkpoint**: Arrancar el servidor con `uvicorn app.main:app --reload` sin error de import. Requests sin `X-Tenant-ID` deben funcionar igual que antes.

---

## Phase 3: User Story 1 — Superadmin registra y activa un nuevo cliente (Priority: P1) 🎯 MVP

**Goal**: El superadmin puede crear un tenant completo (DB + migraciones + admin) con un solo endpoint.

**Independent Test**: `POST /superadmin/tenants` con `{"name":"Acme","slug":"acme","admin_email":"a@acme.com"}` devuelve 201 con `provision_status="active"` y `admin_temp_password`. Verificar `psql -c "\l" | grep erp_acme`.

- [X] T010 [P] [US1] Crear app/modules/superadmin/__init__.py (vacío) y app/modules/superadmin/schemas.py con cinco clases Pydantic: `TenantCreate` (name, slug con regex `^[a-z0-9-]{2,50}$`, admin_email EmailStr), `TenantOut` (id, name, slug, is_active, provision_status, created_at), `TenantOutDetail(TenantOut)` (+db_name, +provision_error), `TenantOutCreated(TenantOut)` (+admin_username, +admin_temp_password), `TenantStatusUpdate` (is_active: bool)
- [X] T011 [US1] Modificar app/core/security/auth.py: añadir rama al inicio de `authenticate_user()` — si `settings.SUPERADMIN_USERNAME` y `username == settings.SUPERADMIN_USERNAME` → verificar con `verify_password(password, settings.SUPERADMIN_PASSWORD_HASH)` → retornar dict con `{"id":"superadmin","username":"superadmin","role":"superadmin","tenant":"__master__","permissions":["superadmin:*"],"primary_module":"superadmin","modules":["superadmin"]}`; modificar `create_access_token()` para incluir `"role"` en el payload si está presente en el dict del usuario
- [X] T012 [US1] Crear app/modules/superadmin/service.py con función `provision_tenant(payload: TenantCreate) -> dict` que ejecuta 5 pasos en secuencia: (1) INSERT en tenants con `provision_status='pending'`; (2) `CREATE DATABASE erp_{slug}` con psycopg2 en `autocommit=True`; (3) helper `_run_migrations(db_name, pg)` — aplica `migrations/000_base_schema.sql` (pg_dump completo) via subprocess psql; (4) helper `_create_admin_user(db_url, admin_email, temp_password)` — INSERT en tabla users con contraseña bcrypt; (5) `UPDATE tenants SET provision_status='active'`; si cualquier paso falla → `UPDATE provision_status='error', provision_error=str(e)` y lanzar HTTPException 500
- [X] T013 [US1] Crear app/modules/superadmin/router.py con: función `require_superadmin(current_user=Depends(get_current_user))` que verifica `current_user.get("role") == "superadmin"` (403 si no); `router = APIRouter(prefix="/superadmin", tags=["superadmin"])`; endpoint `POST /superadmin/tenants` — recibe TenantCreate, llama provision_tenant, retorna TenantOutCreated con status 201
- [X] T014 [US1] Modificar app/main.py: importar `router as superadmin_router` de `app.modules.superadmin.router`; añadir `app.include_router(superadmin_router)` junto al resto de routers
- [X] T015 [US1] Añadir en tests/smoke/test_endpoints.py las fixtures y tests: `_superadmin_token` fixture (login como SUPERADMIN_USERNAME sin X-Tenant-ID header), `test_superadmin_login` (verifica que el token tiene `role=superadmin` en el JWT), `test_create_tenant` (crea tenant con slug único `test-{uuid4_short}`, verifica 201 y `provision_status="active"`, limpia con DELETE DATABASE al finalizar si es posible)

**Checkpoint**: `POST /superadmin/tenants` devuelve 201. `psql -c "\l"` muestra la nueva DB. Login del admin del nuevo tenant funciona con `X-Tenant-ID`.

---

## Phase 4: User Story 2 — Usuario de empresa accede al ERP con aislamiento (Priority: P2)

**Goal**: Los datos de cada empresa son completamente invisibles para las demás. El modo dev sin header sigue funcionando.

**Independent Test**: Material creado en tenant A no aparece en GET /logistics/materials de tenant B. Request sin X-Tenant-ID devuelve datos de la DB local de desarrollo.

- [X] T016 [US2] Añadir en tests/smoke/test_endpoints.py: `test_tenant_isolation` — crea material en tenant A (con header X-Tenant-ID: tenant_A), consulta materials en tenant B (con header X-Tenant-ID: tenant_B), verifica que el material de A NO aparece en B; requiere que T015 haya creado al menos dos tenants de prueba
- [X] T017 [US2] Añadir en tests/smoke/test_endpoints.py: `test_dev_fallback` — ejecuta `GET /health` sin header X-Tenant-ID y verifica respuesta 200 (confirma que el fallback a DATABASE_URL del .env funciona sin error)

**Checkpoint**: `pytest tests/smoke/test_tenant_isolation tests/smoke/test_dev_fallback` — ambos pasan. Datos de empresa A no se filtran a empresa B.

---

## Phase 5: User Story 3 — Superadmin gestiona estado de tenants (Priority: P3)

**Goal**: El superadmin puede listar todos los tenants y activar/desactivar empresas sin reiniciar el sistema.

**Independent Test**: Desactivar tenant → próxima request del usuario de ese tenant recibe 503. Reactivar → acceso restaurado inmediatamente.

- [X] T018 [US3] Añadir en app/modules/superadmin/service.py: función `list_tenants() -> list[dict]` (SELECT * FROM tenants ORDER BY created_at DESC), función `get_tenant(tenant_id: UUID) -> dict` (SELECT por id, 404 si no existe), función `update_tenant_status(tenant_id: UUID, is_active: bool) -> dict` (UPDATE is_active, 404 si no existe, retorna TenantOut)
- [X] T019 [US3] Añadir en app/modules/superadmin/router.py: `GET /superadmin/tenants` (llama list_tenants, retorna List[TenantOut]), `GET /superadmin/tenants/{tenant_id}` (llama get_tenant, retorna TenantOutDetail), `PATCH /superadmin/tenants/{tenant_id}/status` (body: TenantStatusUpdate, llama update_tenant_status, retorna TenantOut actualizado)
- [X] T020 [US3] Añadir en tests/smoke/test_endpoints.py: `test_tenant_deactivate_reactivate` — desactiva tenant de prueba con PATCH /status (is_active=false), verifica que request al ERP con ese X-Tenant-ID devuelve 503, reactiva con PATCH /status (is_active=true), verifica que la misma request devuelve 200

**Checkpoint**: `GET /superadmin/tenants` lista todos los tenants. `PATCH /superadmin/tenants/{id}/status` cambia estado sin reiniciar servidor.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Optimización y validación final de la compuerta.

- [X] T021 [P] Implementar cache in-memory de resolución de tenant en app/core/tenant_middleware.py: dict `_tenant_cache: dict[str, tuple[str, bool, float]] = {}` con estructura `{slug: (db_url, is_active, timestamp)}`; TTL 60 segundos; consultar cache antes de ir a master DB; invalidar entrada si ha expirado
- [X] T022 Ejecutar la compuerta de aceptación: `python -c "import app.main"` (0 errores de import), `pytest tests/smoke/ -v` (22 tests pasan: 17 originales + 5 nuevos), `npm run build` en frontend/ (sin cambios, debe compilar sin errores)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: Sin dependencias — comenzar inmediatamente
- **Foundational (Phase 2)**: Requiere Setup completo — BLOQUEA todas las user stories
- **US1 (Phase 3)**: Requiere Foundational completo — es el MVP mínimo
- **US2 (Phase 4)**: Requiere US1 completo (los tests usan tenants creados en US1)
- **US3 (Phase 5)**: Requiere US1 completo (extiende el módulo superadmin)
- **Polish (Phase 6)**: Requiere US1 + US2 + US3 completos

### User Story Dependencies

- **US1 (P1)**: Solo depende de Foundational — implementable de forma independiente
- **US2 (P2)**: Depende de US1 (necesita tenants existentes para probar aislamiento)
- **US3 (P3)**: Depende de US1 (extiende el mismo módulo superadmin); es independiente de US2

### Dentro de cada User Story

- T010 (schemas) puede ejecutarse en paralelo con T011 (auth) ya que son archivos distintos
- T012 (service) depende de T010 (schemas importados)
- T013 (router) depende de T010 (schemas) y T012 (service)
- T014 (registrar en main.py) depende de T013 (router creado)
- T015 (smoke tests US1) depende de T014 (router registrado y funcional)

### Parallel Opportunities

- T004 y T005 pueden ejecutarse en paralelo (archivos distintos, sin dependencias)
- T010 y T011 pueden ejecutarse en paralelo (archivos distintos)
- T021 (cache) puede ejecutarse en paralelo con otros tasks de Polish
- US3 (T018-T020) puede comenzar en paralelo con US2 (T016-T017) una vez US1 está completo

---

## Parallel Example: Phase 2 Foundational

```bash
# Ejecutar en paralelo (archivos distintos):
Task T004: "Crear app/core/tenant_context.py"
Task T005: "Crear app/core/master_db.py"

# Después de T004 y T005, secuencial:
Task T006: "Modificar app/core/config.py"
Task T007: "Modificar app/core/database.py"   # depende de T004
Task T008: "Crear app/core/tenant_middleware.py"  # depende de T004, T005
Task T009: "Modificar app/main.py"               # depende de T008
```

## Parallel Example: Phase 3 US1

```bash
# Ejecutar en paralelo:
Task T010: "Crear app/modules/superadmin/schemas.py"
Task T011: "Modificar app/core/security/auth.py"

# Después de T010 y T011, secuencial:
Task T012: "Crear app/modules/superadmin/service.py"  # depende de T010
Task T013: "Crear app/modules/superadmin/router.py"   # depende de T010, T012
Task T014: "Registrar superadmin_router en app/main.py"  # depende de T013
Task T015: "Smoke tests US1"                              # depende de T014
```

---

## Implementation Strategy

### MVP First (Solo User Story 1)

1. Completar Phase 1: Setup (T001-T003)
2. Completar Phase 2: Foundational (T004-T009) — CRÍTICO
3. Completar Phase 3: US1 (T010-T015)
4. **STOP y VALIDAR**: `POST /superadmin/tenants` crea tenant, admin puede hacer login
5. Deploy/demo con capacidad de crear nuevos clientes

### Incremental Delivery

1. Setup + Foundational → Backend arranca con tenant routing transparente
2. US1 → Superadmin puede crear clientes → MVP vendible
3. US2 → Tests confirman aislamiento de datos → confianza de producción
4. US3 → Panel de gestión de clientes (activar/desactivar) → operación completa
5. Polish → Cache + tests completos → producción

---

## Notes

- **[P]** = archivos distintos, sin dependencias incompletas → pueden ejecutarse en paralelo
- **T002 requiere acceso a PostgreSQL**: ejecutar `psql` directamente o via pgAdmin
- **T003 requiere generar SUPERADMIN_PASSWORD_HASH**: usar bcrypt en Python antes de arrancar
- **T012 _run_migrations()** aplica `migrations/000_base_schema.sql` (pg_dump de erp_logistica) via subprocess psql — schema completo en un solo archivo, sin dependencias de orden
- **T008 TenantMiddleware**: el fallback sin header NO hace query a master DB — zero overhead en modo dev
- Verificar que todos los 17 smoke tests originales pasan sin `X-Tenant-ID` después de T009 (Phase 2 checkpoint)
