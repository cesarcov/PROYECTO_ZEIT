# Research: Arquitectura Multi-Tenant DB por Cliente

**Feature**: 007-multi-tenant | **Date**: 2026-06-24

---

## D001 — Mecanismo de identificación del tenant por request

**Decision**: Cabecera HTTP `X-Tenant-ID` con valor = slug del tenant (ej. `acme`). Como fallback secundario: parsing de subdominio en `Host` header. Sin cabecera → modo development (usa `DATABASE_URL` del `.env`).

**Rationale**: La cabecera es el mecanismo más simple, explícito, y compatible con APIs REST. El subdominio requiere configuración DNS que no siempre está disponible en desarrollo. Con la cabecera el frontend puede cambiar de tenant sin cambiar URL. El fallback a `DATABASE_URL` garantiza que el flujo de desarrollo actual no cambia.

**Alternatives considered**:
- Path prefix (`/t/acme/logistics/materials`): Requiere cambiar todos los endpoints y el frontend. Rechazado.
- JWT claim: El tenant debería resolverse antes de autenticar al usuario, porque la autenticación ocurre en la DB del tenant. Rechazado (orden de operaciones incorrecto).
- Cookie: Problemático en APIs REST. Rechazado.

---

## D002 — Enrutamiento de conexiones DB sin tocar código de módulos

**Decision**: `contextvars.ContextVar` llamado `_tenant_db_url`. El middleware `TenantMiddleware` lo setea con la URL de la DB del tenant antes de que cualquier handler procese la request. `db_connection()` en `app/core/database.py` lee la ContextVar; si tiene valor la usa, si no usa `DATABASE_URL` del env.

**Rationale**: `ContextVar` es la herramienta exacta de Python para "datos por tarea/coroutine" — funciona en código async y sync, sin race conditions entre requests concurrentes. Este patrón permite que todos los servicios existentes llamen a `db_connection()` sin ningún cambio. Es la solución de menor impacto sobre el código existente.

**Alternatives considered**:
- Pasar `tenant_db_url` como argumento a cada función de servicio: Requiere modificar todas las firmas de función en todos los módulos (decenas de archivos). Rechazado.
- `threading.local()`: No funciona correctamente con async/await en uvicorn. Rechazado.
- Pool de conexiones por tenant con cache en memoria: Correcto para producción de alto tráfico, pero añade complejidad de gestión de ciclo de vida. Reservado para V2.

---

## D003 — Ubicación y estructura de la Master DB

**Decision**: Base de datos PostgreSQL llamada `erp_master` en el mismo servidor que las DBs de los tenants. La Master DB solo tiene una tabla: `tenants`. Las credenciales de conexión a la Master DB se leen del env como `MASTER_DATABASE_URL` (distinto de `DATABASE_URL` que es el fallback single-tenant).

**Rationale**: Mantener todo en el mismo servidor PostgreSQL simplifica la configuración inicial y el backup. La separación por nombre de DB (`erp_master` vs `erp_acme`, `erp_beta`) es suficiente para el aislamiento. Una sola tabla en la Master DB minimiza la complejidad.

**Alternatives considered**:
- Master DB en servidor separado: Añade latencia y complejidad de failover. Rechazado para V1.
- Archivo JSON de configuración de tenants en disco: No soporta múltiples instancias del API. Rechazado.
- Variables de entorno por tenant: No escala más allá de 5-10 clientes. Rechazado.

---

## D004 — Provisionamiento automático de nuevo tenant

**Decision**: El endpoint `POST /superadmin/tenants` ejecuta 4 pasos en secuencia dentro del servicio:
1. INSERT en `erp_master.tenants` con `provision_status = 'pending'`
2. `CREATE DATABASE erp_{slug}` con psycopg2 en modo `autocommit=True` (requerido por PostgreSQL para DDL de DB)
3. Ejecutar todos los archivos `.sql` de `migrations/` en orden numérico contra la nueva DB
4. Crear usuario admin inicial en la nueva DB con contraseña temporal
5. UPDATE `tenants` con `provision_status = 'active'`

Si cualquier paso falla: `provision_status = 'error'` + mensaje de error guardado. El superadmin puede reintentar desde el panel.

**Rationale**: La atomicidad total no es posible porque `CREATE DATABASE` no puede estar dentro de una transacción PostgreSQL. La estrategia de status + reintento es el patrón estándar para operaciones de provisionamiento de infraestructura.

**Alternatives considered**:
- Script de shell separado que llama el API después: Introduce dependencia de entorno que no funciona en contenedores. Rechazado.
- Migración aplicada por Alembic/similar: Añade dependencia nueva, las migraciones actuales son archivos SQL planos que ya funcionan. Rechazado.

---

## D005 — Autenticación del Superadmin

**Decision**: El superadmin se autentica con credenciales en variables de entorno (`SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`). El endpoint `POST /auth/login` tiene una rama especial: si el username coincide con `SUPERADMIN_USERNAME` y la contraseña verifica contra `SUPERADMIN_PASSWORD_HASH`, emite un JWT con claims especiales `{"role": "superadmin", "tenant": "__master__"}`. Los endpoints `/superadmin/*` verifican este claim específicamente.

**Rationale**: El superadmin no pertenece a ningún tenant, por lo que no tiene fila en la tabla `users` de ninguna DB de tenant. Guardarlo en variables de entorno es simple y seguro para V1. El `SUPERADMIN_PASSWORD_HASH` en el env evita guardar contraseñas en texto plano.

**Alternatives considered**:
- Tabla `superadmins` en la Master DB: Correcto para múltiples superadmins, pero añade complejidad. Reservado para V2.
- API key en cabecera: Menos estándar que JWT, y el sistema ya usa JWT para todo. Rechazado.

---

## D006 — Impacto en código existente

**Decision**: Los únicos archivos modificados del código actual son:
- `app/core/database.py` — añadir lectura de ContextVar
- `app/core/security/auth.py` — añadir rama superadmin en authenticate_user
- `app/core/security/router.py` — añadir `request: Request` al login si no está
- `app/main.py` — registrar TenantMiddleware y módulo superadmin

Archivos nuevos:
- `app/core/tenant_context.py` — ContextVar + función helper
- `app/core/tenant_middleware.py` — middleware que resuelve tenant
- `app/core/master_db.py` — conexión a la Master DB
- `app/modules/superadmin/` — router + service + schemas
- `migrations/038_create_master_db.sql` — script de inicialización de erp_master

**Rationale**: Ningún módulo de negocio (logistics, requests, operations, etc.) necesita cambios. El patrón ContextVar es transparente para el código existente. Esto minimiza el riesgo de regresiones.

---

## D007 — Nombre de la DB de cada tenant

**Decision**: `erp_{slug}` donde `slug` solo puede contener letras minúsculas, números y guiones medios (sin espacios, sin caracteres especiales). Validación en el schema Pydantic con regex `^[a-z0-9-]{2,50}$`. El nombre de DB resultante es `erp_acme`, `erp_beta`, etc.

**Rationale**: Nombre predecible, fácil de administrar en pgAdmin, sin riesgo de SQL injection (el nombre de DB no puede parametrizarse en psycopg2, por lo que la validación estricta del slug es la barrera de seguridad).

**Security note**: El nombre de DB se construye con f-string (`f"erp_{slug}"`). La validación regex `^[a-z0-9-]{2,50}$` asegura que no hay caracteres que puedan escaparse del nombre de DB hacia el SQL. Se debe validar **antes** de cualquier uso del slug en SQL.
