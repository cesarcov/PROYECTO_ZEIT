# [F-000] Fase 0 — Endurecimiento del proyecto

- **Estado:** APROBADA
- **Autor:** Plan Maestro SDD
- **Fecha:** 2026-08-05
- **Módulos afectados:** transversal (core, auth, admin, logistics, CI, infra)
- **Migración asignada:** ninguna nueva de negocio; sí `schema_migrations` de control

> Esto NO es una feature de producto: es pagar la deuda técnica antes de que
> cobre intereses. **Se ejecuta antes que cualquier spec de funcionalidad.**
> Objetivo: que romper producción sea difícil.

## 1. Problema

El proyecto tiene 17 módulos en producción y **cero tests automatizados**, sin
CI, con credenciales conocidas documentadas, sin storage persistente (los logos
se pierden en cada redeploy), sin staging y sin backups verificados. Cada módulo
nuevo aumenta el riesgo de regresión silenciosa de forma compuesta.

## 2. Objetivos verificables

- **OBJ-1:** Existe un pipeline de CI que corre en cada push y bloquea merges rojos.
- **OBJ-2:** No hay secretos en el repo ni en el historial de git.
- **OBJ-3:** Las 45+ migraciones se aplican desde cero de forma automática en CI.
- **OBJ-4:** Ningún endpoint queda sin permiso RBAC explícito (deny-by-default).
- **OBJ-5:** Los archivos subidos (logos, avatares) sobreviven a un redeploy.
- **OBJ-6:** Existe un backup lógico propio y se restauró al menos una vez.
- **OBJ-7:** Existe un entorno de staging con su propia base de datos.
- **OBJ-8:** Cobertura de tests backend ≥ 30 % (línea base del trinquete).

## 3. Alcance

- **Incluye:** rotación de credenciales, gitleaks, config tipada, sobre único de
  errores + request-id, Sentry (back y front), UptimeRobot sobre `/health`,
  pipeline CI, branch protection, primeros tests de `auth` + `test_rbac_matrix`,
  context manager único del pool, Supabase Storage para logos/avatares, backup
  diario + simulacro de restauración, rate limiting en login, cabeceras de
  seguridad, entorno staging.
- **NO incluye:** features de producto (Finance, Notificaciones, etc.),
  cobertura > 30 %, 2FA (se planifica pero no es bloqueante de la fase).

## 4. Reglas / decisiones

- **RN-01:** El usuario admin inicial se crea con contraseña **generada
  aleatoriamente** y entregada fuera de banda. `admin/admin123` deja de existir.
- **RN-02:** Todo archivo subido se valida (MIME real por firma binaria + tamaño)
  y se **re-encodea** antes de almacenarse (destruye payloads incrustados).
- **RN-03:** El sistema **no arranca** si falta una variable de entorno crítica
  (fallar temprano y claro).

## 5. Impacto RBAC

- No crea permisos nuevos, pero **audita todos los existentes**: un test recorre
  todas las rutas registradas en FastAPI y falla si alguna no declara permiso.

## 6. Impacto en auditoría

- Ningún cambio de esquema de negocio; se añade `schema_migrations(version,
  name, checksum, applied_at, applied_by)` para control de migraciones.

## 7. Métricas de éxito

Al cierre de la fase: OBJ-1, OBJ-2, OBJ-3, OBJ-4 cumplidos; cobertura ≥ 30 %;
staging operativo; primer simulacro de restauración exitoso.
