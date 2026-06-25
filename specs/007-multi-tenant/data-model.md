# Data Model: Arquitectura Multi-Tenant

**Feature**: 007-multi-tenant | **Date**: 2026-06-24

---

## Entidades

### 1. Tenant (en Master DB: `erp_master`)

Representa una empresa cliente con su propia base de datos aislada.

```
tenants
├── id              UUID        PK, default gen_random_uuid()
├── name            VARCHAR(255) NOT NULL          — "Empresa Acme S.A."
├── slug            VARCHAR(100) UNIQUE NOT NULL   — "acme" (solo [a-z0-9-], 2-50 chars)
├── db_name         VARCHAR(100) UNIQUE NOT NULL   — "erp_acme" (generado: "erp_" + slug)
├── db_url          TEXT NOT NULL                  — postgresql://user:pass@host/erp_acme
├── is_active       BOOLEAN DEFAULT TRUE
├── provision_status VARCHAR(50) DEFAULT 'pending' — 'pending' | 'active' | 'error'
├── provision_error TEXT                           — mensaje de error si provision_status='error'
└── created_at      TIMESTAMP DEFAULT NOW()
```

**Relaciones**: ninguna (entidad raíz en master DB)

**Reglas de validación**:
- `slug`: regex `^[a-z0-9-]{2,50}$` — validado en schema Pydantic ANTES de cualquier uso en SQL
- `name`: 1-255 caracteres, no vacío
- `slug` es inmutable una vez insertado
- `db_name` = `"erp_" + slug` — generado en el servicio, nunca enviado por el cliente

**Transiciones de estado** (`provision_status`):
```
[nuevo] → pending → active
                 ↘ error → [reintento posible desde superadmin]
```

**Transiciones de estado** (`is_active`):
```
active ⇄ inactive (controlado por superadmin)
```
- Desactivar un tenant activo: `is_active = FALSE` → sus usuarios reciben 503
- Reactivar: `is_active = TRUE` → acceso restaurado en próxima request

---

### 2. ContextVar: _tenant_db_url (runtime, no persiste en DB)

Variable de contexto (Python `contextvars.ContextVar`) que existe solo durante la duración de una request HTTP.

```
_tenant_db_url: ContextVar[Optional[str]]
├── Setteado por: TenantMiddleware (lee de X-Tenant-ID header → consulta tenants → extrae db_url)
├── Leído por: db_connection() en app/core/database.py
└── Valor None: indica modo fallback → usa DATABASE_URL del .env
```

---

### 3. Superadmin (en variables de entorno, no en DB)

Entidad de configuración que no tiene representación en ninguna tabla.

```
Env vars:
├── MASTER_DATABASE_URL    — URL de la master DB (erp_master)
├── SUPERADMIN_USERNAME    — nombre de usuario del superadmin
└── SUPERADMIN_PASSWORD_HASH — bcrypt hash de la contraseña
```

El JWT del superadmin contiene:
```json
{
  "sub": "superadmin",
  "role": "superadmin",
  "tenant": "__master__",
  "permissions": ["superadmin:*"]
}
```

---

## Estructura de bases de datos

```
PostgreSQL Server
├── erp_master          ← Master DB (solo tabla: tenants)
│   └── tenants
├── erp_acme            ← Tenant DB: Empresa Acme
│   ├── users
│   ├── materials
│   ├── material_requests
│   ├── ... (todas las tablas del ERP, mismo schema)
│   └── [38 migraciones aplicadas]
├── erp_beta            ← Tenant DB: Empresa Beta
│   └── ... (mismo schema, datos completamente distintos)
└── erp_dev             ← DB de desarrollo local (usada por fallback sin X-Tenant-ID)
    └── ... (actual DATABASE_URL del .env)
```

---

## Impacto en código existente

### Modificados (mínimo)

| Archivo | Cambio |
|---------|--------|
| `app/core/database.py` | `db_connection()` lee `_tenant_db_url` ContextVar; si None → usa `settings.DATABASE_URL` |
| `app/core/config.py` | Añadir `MASTER_DATABASE_URL`, `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH` |
| `app/core/security/auth.py` | Rama especial si username == `SUPERADMIN_USERNAME` → no consulta DB de tenant |
| `app/main.py` | Añadir `TenantMiddleware` al stack; importar y registrar router superadmin |

### Nuevos archivos

| Archivo | Propósito |
|---------|-----------|
| `app/core/tenant_context.py` | ContextVar `_tenant_db_url` + helper `set_tenant_db()` / `get_tenant_db()` |
| `app/core/tenant_middleware.py` | `TenantMiddleware`: lee `X-Tenant-ID`, consulta master DB, setea ContextVar |
| `app/core/master_db.py` | `master_db_connection()`: conexión directa a `MASTER_DATABASE_URL` |
| `app/modules/superadmin/schemas.py` | `TenantCreate`, `TenantOut`, `TenantStatusUpdate` |
| `app/modules/superadmin/service.py` | Lógica de provisionamiento y CRUD de tenants |
| `app/modules/superadmin/router.py` | Endpoints `/superadmin/tenants` |
| `migrations/038_create_master_db.sql` | Crea tabla `tenants` en `erp_master` |

### Sin cambios

Ningún módulo de negocio (logistics, requests, admin, operations, etc.) necesita cambios.
