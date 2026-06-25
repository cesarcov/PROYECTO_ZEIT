<!-- SPECKIT START -->
## Feature activo: 007-multi-tenant

Plan de implementación: `specs/007-multi-tenant/plan.md`

Contexto técnico (para esta feature):
- Backend: Python 3.11 · FastAPI · psycopg2 — sin dependencias nuevas
- Patrón central: `ContextVar` en `app/core/tenant_context.py` → `db_connection()` lo lee → routing transparente
- Nuevo módulo: `app/modules/superadmin/` (router + service + schemas)
- Archivos core nuevos: `tenant_context.py`, `tenant_middleware.py`, `master_db.py`
- Archivos core modificados: `database.py`, `config.py`, `security/auth.py`, `main.py`
- Middleware: `TenantMiddleware` lee `X-Tenant-ID` header, resuelve DB URL desde `erp_master`
- Superadmin: credenciales en `.env` (`SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`), JWT con `role=superadmin`
- Provisionamiento: `POST /superadmin/tenants` → CREATE DATABASE + run migrations + crear admin
- Fallback dev: sin `X-Tenant-ID` → usa `DATABASE_URL` del `.env` (17 smoke tests pasan sin cambios)
- Migración: `038_create_master_db.sql` se aplica manualmente a `erp_master` (NO al runner de tenants)
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` → 22 tests + `npm run build`)

Para detalles del QUÉ/CÓMO, leer el plan y la spec en `specs/007-multi-tenant/`.
<!-- SPECKIT END -->
