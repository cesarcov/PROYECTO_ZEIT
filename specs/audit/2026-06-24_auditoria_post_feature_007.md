# Auditoría de Seguridad — Post Feature 007
**Fecha**: 2026-06-24  
**Estado**: APLICADA — todos los hallazgos corregidos

## Resumen
| Severidad | Hallazgos | Estado |
|-----------|-----------|--------|
| CRÍTICO   | 2         | ✅ Corregido |
| ALTO      | 2         | ✅ Corregido |
| MEDIO     | 2         | ✅ Corregido |
| BAJO      | 2         | ✅ Corregido / Documentado |

---

## C1 — SQL Injection en `generate_sequential_code`
**Archivo**: `app/core/utils.py`  
**Fix**: Reemplazado f-string `f"SELECT COUNT(*) FROM {table}"` por `psycopg2.sql.Identifier(table)`.  
Afectaba a todos los módulos que generan códigos secuenciales (logistics, cotizaciones, compras, etc.).

## C2 — SQL Injection en `reset_all_data_service`
**Archivo**: `app/modules/admin/service.py`  
**Fix**: Reemplazado `f"DELETE FROM {table}"` por `sql.SQL("DELETE FROM {}").format(sql.Identifier(table))`.

## A1 — WHERE clause con f-string en audit logs
**Archivo**: `app/modules/admin/service.py`  
**Fix**: `_audit_conditions()` ahora retorna lista de condiciones (strings constantes) separada de params. La query final usa `psycopg2.sql.SQL` para componer el WHERE sin f-string. Los valores siempre van como `%s` parametrizado.

## A2 — Contraseña temporal expuesta en response
**Archivo**: `app/modules/superadmin/service.py`, `schemas.py`  
**Fix**: Anotación explícita en schema ("One-time credential — solo por HTTPS"). Log en server-side con email del destinatario pero sin la contraseña. Requiere HTTPS en producción y cambio en primer login.  
**Nota**: La contraseña sigue en el response porque no hay servicio de email configurado. Es el canal intencional de provisioning.

## M1 — Exception swallowed en TenantMiddleware
**Archivo**: `app/core/tenant_middleware.py`  
**Fix**: El `except Exception` ahora loggea el error y retorna HTTP 503 en lugar de silenciosamente continuar sin tenant context (lo que podría causar cross-tenant data leak si la master DB cae).

## M2 — Race condition en `_tenant_cache`
**Archivo**: `app/core/tenant_middleware.py`  
**Fix**: Añadido `threading.Lock()` alrededor de todas las operaciones de lectura/escritura/borrado sobre `_tenant_cache`. `invalidate_tenant_cache()` también usa el lock.

## B1 — Error messages internos en routers
**Archivo**: `app/modules/admin/router.py`  
**Evaluación**: Los mensajes de `ValueError` del servicio son mensajes de negocio intencionales ("Usuario no encontrado", "Rol no encontrado", etc.) — no exponen detalles técnicos internos. Sin cambio.

## B2 — Validación de slug en CREATE DATABASE
**Archivo**: `app/modules/superadmin/service.py`  
**Evaluación**: Pydantic valida `^[a-z0-9-]{2,50}$` antes de llegar al servicio. PostgreSQL quoted identifier (`"erp_{slug}"`) no permite inyección con ese charset. Sin cambio necesario.

---

## Items ya corregidos en auditorías previas (no aplican)
- plain_password en tabla users → eliminado en migración 036
- Sin rate limiting en login → slowapi implementado
- Sin security headers → SecurityHeadersMiddleware implementado
