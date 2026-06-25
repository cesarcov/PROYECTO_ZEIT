# Research: Solicitudes Multi-Item con Trazabilidad

**Feature**: 006-solicitudes-multi-material | **Date**: 2026-06-24

---

## Decisión 1: Estrategia de compatibilidad backward

**Decisión**: Dual-write controlado — las nuevas solicitudes multi-item escriben en `material_request_items` Y preservan `related_material_id` = primer ítem (para que las queries existentes sigan funcionando sin cambio).

**Rationale**: El módulo tiene 4 queries activas que hacen `JOIN materials m ON m.id = mr.related_material_id`. Cambiar ese JOIN a LEFT JOIN y manejar NULL requeriría actualizar todas las respuestas de API, arriesgando regresiones. El dual-write es una estrategia estándar de migración aditiva: el campo legacy actúa como "ítem primario" y los demás ítems van en la tabla de detalle.

**Alternativas consideradas**:
- A) Cambiar todas las queries a LEFT JOIN y permitir `related_material_id = NULL` → requiere actualizar 4 funciones de listado y sus respuestas; mayor riesgo de regresión.
- B) Endpoint nuevo `/material-requests/v2` para multi-item → duplicación de lógica, mayor superficie de API, confusión para el frontend.
- C) Dual-write (elegida) → cero cambios en queries existentes, compatibilidad garantizada.

---

## Decisión 2: Cuándo registrar el audit trail

**Decisión**: El INSERT en `material_request_audit` se hace dentro de la misma transacción psycopg2 que el UPDATE de estado. Si falla el audit, se hace rollback del cambio de estado (FR-006 del spec).

**Rationale**: psycopg2 abre una transacción por defecto (autocommit=False). Haciendo ambas operaciones antes del `conn.commit()`, quedan atómicas sin necesidad de `BEGIN EXPLICIT` adicional. Este es el patrón que ya usa `approve_material_request_service` para el UPDATE + commit.

**Alternativas consideradas**:
- A) Audit en trigger PostgreSQL → requiere migración de DB y es opaco para el código Python.
- B) Audit post-commit en un try/except → no garantiza atomicidad (el audit puede fallar silenciosamente).
- C) Misma transacción (elegida) → garantía de atomicidad con código mínimo.

---

## Decisión 3: Validación de ítems duplicados

**Decisión**: Validación en el service Python (no en DB) antes de insertar: si hay `material_id` repetido en la lista de ítems, raise HTTPException 422 con mensaje claro.

**Rationale**: La tabla `material_request_items` no tiene UNIQUE(request_id, material_id), por lo que DB no lo bloquea sola. Validar en Python permite dar un mensaje de error claro en español al frontend. Se puede añadir la constraint de DB en una migración futura sin romper nada.

**Alternativas consideradas**:
- A) Constraint UNIQUE en DB ahora → requeriría una migración 037 adicional (posible, pero fuera del alcance mínimo).
- B) Consolidar ítems duplicados automáticamente sumando cantidades → comportamiento sorpresivo, el usuario debería limpiar su lista.
- C) Validación en Python service (elegida) → mensaje claro, sin migración, implementación inmediata.

---

## Decisión 4: Formato de la respuesta de historial de auditoría

**Decisión**: El endpoint `GET /requests/material-requests/{id}/history` devuelve lista cronológica de eventos con: `action`, `old_status`, `new_status`, `actor_username`, `source`, `created_at`.

**Rationale**: El campo `actor_id` en `material_request_audit` es UUID; el frontend necesita el nombre. Se hace JOIN con `users.username` en el service. El campo `action` describe la acción (ej. "APPROVED", "REJECTED") y complementa `new_status`.

**Estado actual del código de approve/reject**:
- `approve_material_request_service`: hace SELECT FOR UPDATE + UPDATE. Añadir INSERT audit es trivial antes del commit.
- `reject_material_request_service`: mismo patrón. También se añade INSERT audit.
- Ambos ya tienen el `current_user` disponible para usar como `actor_id`.

---

## Sin incógnitas pendientes

Todos los `NEEDS CLARIFICATION` resueltos. La implementación puede proceder directamente.
