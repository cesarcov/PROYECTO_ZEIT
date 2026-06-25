# API Contracts: Superadmin Multi-Tenant

**Feature**: 007-multi-tenant | **Date**: 2026-06-24

Todos los endpoints `/superadmin/*` requieren JWT con claim `"role": "superadmin"`.
El header `X-Tenant-ID` NO se incluye en requests del superadmin.

---

## Autenticación del Superadmin

### POST /auth/login (comportamiento extendido)

Sin cambios en la firma. Comportamiento interno extendido: si `username` coincide con `SUPERADMIN_USERNAME` del env, verifica contraseña contra `SUPERADMIN_PASSWORD_HASH` y emite JWT especial.

**Request** (sin cambios):
```json
{ "username": "superadmin", "password": "..." }
```

**Response 200** (superadmin):
```json
{
  "access_token": "<JWT con role=superadmin>",
  "token_type": "bearer"
}
```

El JWT decodificado contiene:
```json
{
  "sub": "superadmin",
  "role": "superadmin",
  "tenant": "__master__",
  "permissions": ["superadmin:*"],
  "exp": 1234567890
}
```

---

## CRUD de Tenants

### POST /superadmin/tenants — Crear y provisionar nuevo tenant

**Auth**: JWT superadmin requerido

**Request**:
```json
{
  "name": "Empresa Acme S.A.",
  "slug": "acme",
  "admin_email": "admin@acme.com"
}
```

**Validaciones**:
- `slug`: regex `^[a-z0-9-]{2,50}$`, único en la tabla tenants
- `name`: 1-255 chars, no vacío
- `admin_email`: email válido

**Response 201** (éxito):
```json
{
  "id": "uuid",
  "name": "Empresa Acme S.A.",
  "slug": "acme",
  "db_name": "erp_acme",
  "is_active": true,
  "provision_status": "active",
  "admin_username": "admin",
  "admin_temp_password": "TmpP@ss2026",
  "created_at": "2026-06-24T15:30:00Z"
}
```

**Response 409** (slug duplicado):
```json
{ "detail": "Ya existe un tenant con el slug 'acme'." }
```

**Response 422** (slug inválido):
```json
{ "detail": [{ "loc": ["body", "slug"], "msg": "El slug solo puede contener letras minúsculas, números y guiones." }] }
```

**Response 500** (error de provisionamiento):
```json
{ "detail": "Error durante el provisionamiento. tenant_id=uuid status=error" }
```

---

### GET /superadmin/tenants — Listar todos los tenants

**Auth**: JWT superadmin requerido

**Response 200**:
```json
[
  {
    "id": "uuid",
    "name": "Empresa Acme S.A.",
    "slug": "acme",
    "is_active": true,
    "provision_status": "active",
    "created_at": "2026-06-24T15:30:00Z"
  }
]
```

---

### GET /superadmin/tenants/{tenant_id} — Detalle de un tenant

**Auth**: JWT superadmin requerido

**Response 200**:
```json
{
  "id": "uuid",
  "name": "Empresa Acme S.A.",
  "slug": "acme",
  "db_name": "erp_acme",
  "is_active": true,
  "provision_status": "active",
  "provision_error": null,
  "created_at": "2026-06-24T15:30:00Z"
}
```

**Response 404**:
```json
{ "detail": "Tenant no encontrado." }
```

---

### PATCH /superadmin/tenants/{tenant_id}/status — Activar o desactivar tenant

**Auth**: JWT superadmin requerido

**Request**:
```json
{ "is_active": false }
```

**Response 200**:
```json
{ "id": "uuid", "slug": "acme", "is_active": false }
```

---

## Comportamiento del middleware TenantMiddleware

### Request con X-Tenant-ID válido y tenant activo

**Header**: `X-Tenant-ID: acme`

→ Middleware resuelve DB URL, setea ContextVar → request procesada normalmente en DB de `acme`

---

### Request con X-Tenant-ID de tenant inexistente

**Header**: `X-Tenant-ID: noexiste`

**Response 404**:
```json
{ "detail": "Empresa 'noexiste' no encontrada." }
```

---

### Request con X-Tenant-ID de tenant inactivo

**Header**: `X-Tenant-ID: acme` (acme está desactivado)

**Response 503**:
```json
{ "detail": "La empresa 'acme' está temporalmente suspendida. Contacta al administrador." }
```

---

### Request sin X-Tenant-ID (modo development/fallback)

Sin header → middleware no setea ContextVar → `db_connection()` usa `DATABASE_URL` del `.env`

→ Request procesada normalmente (comportamiento actual, sin cambios)

---

## Orden en el middleware stack

```
SecurityHeaders → TenantMiddleware → SlowAPI → Audit → CORS
```

`TenantMiddleware` debe ejecutarse antes que cualquier handler de autenticación, porque la autenticación del usuario ocurre en la DB del tenant.

**Excepción**: El endpoint `POST /auth/login` del superadmin no tiene `X-Tenant-ID`. El middleware debe bypass para requests del superadmin detectando que el username en el body es el SUPERADMIN_USERNAME, O simplemente ignorar la ausencia de header en modo fallback.
