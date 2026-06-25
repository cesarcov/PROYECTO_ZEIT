# Quickstart: Validación Multi-Tenant

**Feature**: 007-multi-tenant | **Date**: 2026-06-24

Guía de validación end-to-end. No incluye código de implementación — para eso ver [plan.md](plan.md).

---

## Prerrequisitos

1. PostgreSQL server corriendo en localhost (mismo servidor que la DB actual)
2. El usuario PostgreSQL en `DATABASE_URL` debe tener permisos de `CREATEDB`
3. Variables de entorno en `.env` con los nuevos campos:
   ```
   MASTER_DATABASE_URL=postgresql://user:pass@localhost/erp_master
   SUPERADMIN_USERNAME=superadmin
   SUPERADMIN_PASSWORD_HASH=<bcrypt hash de la contraseña>
   ```
4. Script de inicialización de master DB ejecutado:
   ```powershell
   psql -U postgres erp_master -f migrations/038_create_master_db.sql
   ```
5. Backend arrancado: `uvicorn app.main:app --reload`

---

## Escenario 1: Superadmin crea un nuevo tenant (US1-P1)

**Propósito**: Verificar que el provisionamiento completo funciona en <30 segundos.

```bash
# Paso 1: Login como superadmin (sin X-Tenant-ID)
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "tu_password"}'
# → Guarda el access_token

# Paso 2: Crear tenant "acme"
curl -X POST http://localhost:8000/superadmin/tenants \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Empresa Acme S.A.", "slug": "acme", "admin_email": "admin@acme.com"}'
# → Esperado: 201 con provision_status="active" y admin_temp_password

# Paso 3: Verificar que la DB se creó
psql -U postgres -c "\l" | grep erp_acme
# → Debe listar "erp_acme"

# Paso 4: Verificar que el admin de Acme puede hacer login
curl -X POST http://localhost:8000/auth/login \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "<admin_temp_password>"}'
# → Esperado: 200 con access_token
```

**Criterio de éxito**: Del paso 2 al paso 4 debe transcurrir menos de 30 segundos.

---

## Escenario 2: Aislamiento de datos entre tenants (US2-P2)

**Propósito**: Verificar FR-010 — los datos de un tenant son invisibles para otro.

```bash
# Setup: Crear dos tenants (acme ya existe, crear beta)
curl -X POST http://localhost:8000/superadmin/tenants \
  -H "Authorization: Bearer <superadmin_token>" \
  -d '{"name": "Empresa Beta", "slug": "beta", "admin_email": "admin@beta.com"}'

# Paso 1: Login como admin de Acme
curl -X POST http://localhost:8000/auth/login \
  -H "X-Tenant-ID: acme" \
  -d '{"username": "admin", "password": "<acme_admin_password"}'
# → Guarda acme_token

# Paso 2: Crear material en Acme
curl -X POST http://localhost:8000/logistics/materials \
  -H "Authorization: Bearer <acme_token>" \
  -H "X-Tenant-ID: acme" \
  -H "Content-Type: application/json" \
  -d '{"name": "Cable X", "code": "CX-001", "unit": "m", "category": "Cables"}'
# → 201

# Paso 3: Login como admin de Beta
curl -X POST http://localhost:8000/auth/login \
  -H "X-Tenant-ID: beta" \
  -d '{"username": "admin", "password": "<beta_admin_password>"}'
# → Guarda beta_token

# Paso 4: Verificar que el material de Acme NO está en Beta
curl http://localhost:8000/logistics/materials \
  -H "Authorization: Bearer <beta_token>" \
  -H "X-Tenant-ID: beta"
# → 200 con lista vacía [] — "Cable X" NO aparece
```

**Criterio de éxito**: "Cable X" no aparece en el listado de Beta.

---

## Escenario 3: Desactivar y reactivar tenant (US3-P3)

**Propósito**: Verificar FR-005 y FR-009.

```bash
# Paso 1: Desactivar tenant Acme
curl -X PATCH http://localhost:8000/superadmin/tenants/<acme_id>/status \
  -H "Authorization: Bearer <superadmin_token>" \
  -d '{"is_active": false}'
# → 200

# Paso 2: Intentar acceder con usuario de Acme
curl http://localhost:8000/logistics/materials \
  -H "Authorization: Bearer <acme_token>" \
  -H "X-Tenant-ID: acme"
# → 503 "La empresa 'acme' está temporalmente suspendida."

# Paso 3: Reactivar
curl -X PATCH http://localhost:8000/superadmin/tenants/<acme_id>/status \
  -H "Authorization: Bearer <superadmin_token>" \
  -d '{"is_active": true}'
# → 200

# Paso 4: Verificar restauración
curl http://localhost:8000/logistics/materials \
  -H "Authorization: Bearer <acme_token>" \
  -H "X-Tenant-ID: acme"
# → 200 con lista de materiales de Acme
```

---

## Escenario 4: Compatibilidad con desarrollo local (US2 - FR-007)

**Propósito**: Verificar SC-004 — los 17 smoke tests actuales pasan sin cambios.

```bash
# Sin X-Tenant-ID — debe usar DATABASE_URL del .env (comportamiento actual)
pytest tests/smoke/ -v
# → 17 passed, 0 failed, 0 skipped
```

**Criterio de éxito**: Los 17 smoke tests pasan sin modificaciones.

---

## Escenario 5: Slug inválido rechazado

```bash
curl -X POST http://localhost:8000/superadmin/tenants \
  -H "Authorization: Bearer <superadmin_token>" \
  -d '{"name": "Empresa X", "slug": "empresa con espacios", "admin_email": "x@x.com"}'
# → 422

curl -X POST http://localhost:8000/superadmin/tenants \
  -H "Authorization: Bearer <superadmin_token>" \
  -d '{"name": "Empresa X", "slug": "acme", "admin_email": "x@x.com"}'
# → 409 (slug duplicado)
```

---

## Escenario 6: Tenant no encontrado

```bash
curl http://localhost:8000/logistics/materials \
  -H "Authorization: Bearer <any_token>" \
  -H "X-Tenant-ID: noexiste"
# → 404 "Empresa 'noexiste' no encontrada."
```

---

## Smoke tests a añadir

Los siguientes tests se añaden a `tests/smoke/test_endpoints.py`:

| Test | Descripción | Criterio |
|------|-------------|----------|
| `test_superadmin_login` | Login superadmin sin X-Tenant-ID | 200 + JWT con role=superadmin |
| `test_create_tenant` | POST /superadmin/tenants slug=test-{uuid} | 201 + provision_status=active |
| `test_tenant_isolation` | Material en tenant A invisible en tenant B | len(lista_B) == 0 |
| `test_tenant_deactivate` | PATCH status false → 503 en next request | 503 con mensaje suspendida |
| `test_dev_fallback` | Request sin X-Tenant-ID → DB local | 200 normal |
