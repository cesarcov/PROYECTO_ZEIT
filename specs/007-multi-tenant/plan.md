# Implementation Plan: Arquitectura Multi-Tenant (DB por Cliente)

**Branch**: `007-multi-tenant` | **Date**: 2026-06-24 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/007-multi-tenant/spec.md`

---

## Summary

Migrar el ERP de arquitectura single-tenant a multi-tenant con una base de datos PostgreSQL por empresa cliente. El mecanismo central es un `ContextVar` de Python que el middleware `TenantMiddleware` setea con la URL de DB del tenant resuelto por cabecera `X-Tenant-ID`, haciendo que `db_connection()` en todos los módulos existentes enrute automáticamente — **sin modificar ningún módulo de negocio**. Se añade un módulo `superadmin` con endpoints para provisionamiento automático (crear DB + migraciones + admin inicial) y gestión del ciclo de vida de tenants.

---

## Technical Context

**Language/Version**: Python 3.11

**Primary Dependencies**:
- FastAPI 0.128.0, uvicorn 0.40.0 (ya en proyecto)
- psycopg2-binary 2.9.11 (ya en proyecto — se usa para `CREATE DATABASE` con `autocommit=True`)
- python-jose 3.5.0, bcrypt 3.2.2 (ya en proyecto — para JWT superadmin)
- pydantic 2.12.5, pydantic-settings (ya en proyecto)
- `contextvars` — stdlib Python 3.7+, sin dependencia nueva

**No hay dependencias nuevas que añadir a requirements.txt.**

**Storage**:
- Master DB: `erp_master` (PostgreSQL, misma instancia que el ERP)
- Tenant DBs: `erp_{slug}` (una por cliente, misma instancia PostgreSQL)
- Fallback dev DB: actual `DATABASE_URL` del `.env` (comportamiento sin cambios)

**Testing**: pytest + `tests/smoke/` (17 tests existentes deben pasar sin cambios; +5 nuevos)

**Target Platform**: Linux server / Windows dev (sin cambios)

**Project Type**: Web service (FastAPI backend)

**Performance Goals**: El overhead de resolver el tenant (una query a master DB por request) debe ser ≤50ms. Para optimizar: cache in-memory `slug → db_url` con TTL de 60 segundos.

**Constraints**:
- `db_connection()` no cambia su firma — solo lee la ContextVar internamente
- `slug` del tenant nunca puede modificarse una vez creado
- `CREATE DATABASE` no puede estar en una transacción PostgreSQL → usar `autocommit=True`
- Validar `slug` con regex `^[a-z0-9-]{2,50}$` **antes** de cualquier uso en SQL (barrera anti-injection)
- SUPERADMIN_PASSWORD_HASH almacenado como bcrypt, nunca en texto plano

**Scale/Scope**: V1 — hasta ~50 tenants en la misma instancia PostgreSQL

---

## Constitution Check

*GATE: Verificación de cumplimiento con la constitución del proyecto.*

| Artículo | Regla | Estado |
|---------|-------|--------|
| Art. 1 — Estructura módulos | Nuevo módulo `app/modules/superadmin/` con router/service/schemas | ✅ CUMPLE |
| Art. 1 — SQL en services | Todas las queries en `superadmin/service.py` y `core/tenant_middleware.py` | ✅ CUMPLE |
| Art. 2 — Auth/permisos | Endpoints `/superadmin/*` verifican claim `role=superadmin` en JWT | ✅ CUMPLE |
| Art. 3 — Sin migraciones destructivas | La migración 038 solo crea tabla en erp_master (nueva DB) | ✅ CUMPLE |
| Art. 4 — Aditivo | Ningún módulo de negocio modificado; solo 4 archivos core mínimos | ✅ CUMPLE |
| Art. 5 — Sin plain_password | Admin inicial de tenant creado con bcrypt hash | ✅ CUMPLE |
| Seguridad — SQL injection | `slug` validado con regex antes de uso en f-string `CREATE DATABASE erp_{slug}` | ✅ CUMPLE |

**Violaciones detectadas**: 0 — listo para implementar.

---

## Project Structure

### Documentation (this feature)

```text
specs/007-multi-tenant/
├── plan.md          # Este archivo (/speckit-plan output)
├── spec.md          # Especificación funcional
├── research.md      # Decisiones técnicas D001-D007 (/speckit-plan Phase 0)
├── data-model.md    # Entidades y modelo de datos (/speckit-plan Phase 1)
├── quickstart.md    # Guía de validación end-to-end (/speckit-plan Phase 1)
├── contracts/
│   └── api.md       # Contratos de API del módulo superadmin (/speckit-plan Phase 1)
└── tasks.md         # (output de /speckit-tasks — pendiente)
```

### Source Code (repository root)

```text
app/
├── core/
│   ├── config.py                  # MODIFICADO: +MASTER_DATABASE_URL, +SUPERADMIN_*
│   ├── database.py                # MODIFICADO: db_connection() lee ContextVar
│   ├── tenant_context.py          # NUEVO: ContextVar _tenant_db_url + helpers
│   ├── tenant_middleware.py       # NUEVO: TenantMiddleware (BaseHTTPMiddleware)
│   ├── master_db.py               # NUEVO: master_db_connection() para erp_master
│   └── security/
│       └── auth.py                # MODIFICADO: rama superadmin en authenticate_user
├── modules/
│   └── superadmin/               # NUEVO módulo
│       ├── schemas.py             # TenantCreate, TenantOut, TenantStatusUpdate
│       ├── service.py             # provision_tenant, list_tenants, update_status
│       └── router.py             # /superadmin/tenants CRUD
└── main.py                       # MODIFICADO: +TenantMiddleware, +superadmin_router

migrations/
└── 038_create_master_db.sql       # NUEVO: CREATE TABLE tenants en erp_master

tests/smoke/
└── test_endpoints.py             # MODIFICADO: +5 test_tenant_* tests
```

**Structure Decision**: Web service FastAPI. Se añade `app/modules/superadmin/` siguiendo la convención existente. Los archivos de infraestructura tenant van en `app/core/` siguiendo la convención de `rate_limit.py`, `scheduler.py`, `security_headers.py`.

---

## Implementation Phases

### Phase 0 — Infraestructura de contexto (prerequisito de todo lo demás)

**Goal**: `db_connection()` soporta routing automático a tenant DB sin cambiar su firma.

**Archivos**:
1. **`app/core/tenant_context.py`** (nuevo):
   ```python
   from contextvars import ContextVar
   from typing import Optional
   _tenant_db_url: ContextVar[Optional[str]] = ContextVar('_tenant_db_url', default=None)
   def set_tenant_db(url: str) -> None: _tenant_db_url.set(url)
   def get_tenant_db() -> Optional[str]: return _tenant_db_url.get()
   ```

2. **`app/core/database.py`** (modificar `db_connection()`):
   ```python
   from app.core.tenant_context import get_tenant_db
   @contextmanager
   def db_connection():
       tenant_url = get_tenant_db()
       url = tenant_url if tenant_url else settings.DATABASE_URL
       _db = _parse_db_url(url)
       # ... resto sin cambios
   ```

3. **`app/core/config.py`** (añadir campos):
   ```python
   MASTER_DATABASE_URL: str = ""  # opcional en dev (fallback a DATABASE_URL)
   SUPERADMIN_USERNAME: str = "superadmin"
   SUPERADMIN_PASSWORD_HASH: str = ""
   ```
   Cambiar `extra = "forbid"` → `extra = "ignore"` O añadir los campos.

4. **`app/core/master_db.py`** (nuevo):
   ```python
   from contextlib import contextmanager
   from app.core.config import settings
   from app.core.database import _parse_db_url
   import psycopg2
   @contextmanager
   def master_db_connection():
       url = settings.MASTER_DATABASE_URL or settings.DATABASE_URL
       _db = _parse_db_url(url)
       conn = psycopg2.connect(**_db)
       try: yield conn
       except Exception: conn.rollback(); raise
       finally: conn.close()
   ```

### Phase 1 — TenantMiddleware

**Goal**: Cada request con `X-Tenant-ID` se enruta automáticamente a la DB del tenant.

**Archivo**: `app/core/tenant_middleware.py` (nuevo)

**Lógica**:
1. Leer `request.headers.get("X-Tenant-ID")`
2. Si ausente → `await call_next(request)` sin tocar ContextVar (fallback = .env DB)
3. Si presente → consultar `tenants` en master DB donde `slug = header_value`
4. Si no existe → `JSONResponse(404, {"detail": "Empresa '{slug}' no encontrada."})`
5. Si `is_active = FALSE` → `JSONResponse(503, {"detail": "La empresa '...' está suspendida."})`
6. Si OK → `set_tenant_db(db_url)` → `await call_next(request)`

**Cache de performance** (opcional, implementar si hay muchas requests por segundo):
- Dict in-memory `{slug: (db_url, is_active, timestamp)}`
- TTL: 60 segundos (tiempo máximo entre desactivación y efecto)

**Registro en `main.py`**:
```python
from app.core.tenant_middleware import TenantMiddleware
# Orden: SecurityHeaders → TenantMiddleware → SlowAPI → Audit → CORS
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(SlowAPIMiddleware)
# ... resto sin cambios
```

**También en `main.py`**: añadir `X-Tenant-ID` a `allow_headers` del CORS:
```python
allow_headers=["Content-Type", "Authorization", "X-Tenant-ID"],
```

### Phase 2 — Superadmin auth

**Goal**: El superadmin puede hacer login con credenciales en `.env` y obtener JWT especial.

**Archivo**: `app/core/security/auth.py`

**Cambio en `authenticate_user()`** — añadir rama al inicio:
```python
if settings.SUPERADMIN_USERNAME and username == settings.SUPERADMIN_USERNAME:
    if verify_password(password, settings.SUPERADMIN_PASSWORD_HASH):
        return {
            "id": "superadmin",
            "username": "superadmin",
            "role": "superadmin",
            "tenant": "__master__",
            "permissions": ["superadmin:*"],
            "primary_module": "superadmin",
            "modules": ["superadmin"],
        }
    return None
```

**`create_access_token()`**: añadir campo `role` al payload si presente en el dict devuelto.

**Nueva dependency** en `app/core/security/dependencies.py` (o en `router.py` de superadmin):
```python
def require_superadmin(current_user = Depends(get_current_user)):
    if current_user.get("role") != "superadmin":
        raise HTTPException(403, "Acceso restringido al superadmin.")
    return current_user
```

### Phase 3 — Módulo Superadmin

**Goal**: Endpoints CRUD de tenants + lógica de provisionamiento.

**Archivos**:

**`app/modules/superadmin/schemas.py`**:
```python
class TenantCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., pattern=r'^[a-z0-9-]{2,50}$')
    admin_email: EmailStr

class TenantOut(BaseModel):
    id: UUID; name: str; slug: str; is_active: bool
    provision_status: str; created_at: datetime

class TenantOutDetail(TenantOut):
    db_name: str; provision_error: Optional[str]

class TenantOutCreated(TenantOut):
    admin_username: str; admin_temp_password: str

class TenantStatusUpdate(BaseModel):
    is_active: bool
```

**`app/modules/superadmin/service.py`** — funciones principales:
- `provision_tenant(payload)`: 5 pasos (INSERT pending → CREATE DATABASE → run migrations → create admin → UPDATE active)
- `list_tenants()`: SELECT * FROM tenants ORDER BY created_at DESC
- `get_tenant(tenant_id)`: SELECT por id
- `update_tenant_status(tenant_id, is_active)`: UPDATE is_active
- `_run_migrations(db_url)`: ejecuta todos los .sql de `migrations/` en orden numérico (excluyendo 038_create_master_db.sql)
- `_create_admin_user(db_url, email, temp_password)`: INSERT en tabla users de la nueva DB

**`app/modules/superadmin/router.py`**:
```python
router = APIRouter(prefix="/superadmin", tags=["superadmin"])

@router.post("/tenants", status_code=201)
@router.get("/tenants")
@router.get("/tenants/{tenant_id}")
@router.patch("/tenants/{tenant_id}/status")
```

**Registro en `main.py`**:
```python
from app.modules.superadmin.router import router as superadmin_router
app.include_router(superadmin_router)
```

### Phase 4 — Migración 038

**Archivo**: `migrations/038_create_master_db.sql`

```sql
-- Ejecutar manualmente contra erp_master UNA SOLA VEZ
-- psql -U postgres erp_master -f migrations/038_create_master_db.sql
CREATE TABLE IF NOT EXISTS tenants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    slug             VARCHAR(100) UNIQUE NOT NULL,
    db_name          VARCHAR(100) UNIQUE NOT NULL,
    db_url           TEXT NOT NULL,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    provision_status VARCHAR(50)  NOT NULL DEFAULT 'pending',
    provision_error  TEXT,
    created_at       TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**NOTA IMPORTANTE**: Este script se ejecuta una sola vez en `erp_master`. NO debe incluirse en el runner de migraciones que se aplica a los tenant DBs.

### Phase 5 — Smoke Tests

**Goal**: SC-004 — 17 tests existentes pasan sin cambios; 5 nuevos tests de tenant.

**Archivo**: `tests/smoke/test_endpoints.py`

Nuevos tests (ver detalle en [quickstart.md](quickstart.md)):
- `test_superadmin_login`
- `test_create_tenant`
- `test_tenant_isolation`
- `test_tenant_deactivate_reactivate`
- `test_dev_fallback`

---

## Compuerta de aceptación (verify.ps1 existente)

```
1. python -c "import app.main"   → 0 errors (sin import circular)
2. pytest tests/smoke/ -v        → 22 passed (17 originales + 5 nuevos), 0 failed
3. npm run build                 → frontend sin cambios, compilation OK
```

---

## Complexity Tracking

> No hay violaciones a la constitución — sección vacía intencionalmente.
