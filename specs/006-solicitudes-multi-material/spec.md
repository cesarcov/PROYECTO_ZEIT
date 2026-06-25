# Feature Specification: Solicitudes de Materiales Multi-Item con Trazabilidad

**Feature Branch**: `006-solicitudes-multi-material`

**Created**: 2026-06-24

**Status**: Draft

**Input**: Solicitudes de materiales multi-item con trazabilidad de aprobaciones. Activar material_request_items y material_request_audit que ya existen en la DB pero sin código activo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Crear solicitud con varios materiales (Priority: P1)

Un técnico necesita pedir varios materiales para una obra al mismo tiempo. Hoy tiene que crear una solicitud separada por cada material, lo que genera ruido, es lento y difícil de rastrear. Con esta feature puede agrupar todos los materiales que necesita en una sola solicitud.

**Why this priority**: Es el cambio central de la feature y el que más valor entrega al usuario. Sin él, el resto no tiene sentido.

**Independent Test**: Se puede testear creando una solicitud vía API con 3 materiales distintos y verificando que los 3 quedan registrados como ítems de esa misma solicitud.

**Acceptance Scenarios**:

1. **Given** un técnico autenticado, **When** crea una solicitud con una lista de 3 materiales (cada uno con material_id y cantidad), **Then** la solicitud se crea con estado PENDING y los 3 materiales quedan registrados como ítems vinculados.
2. **Given** una solicitud existente con múltiples ítems, **When** se consulta la solicitud, **Then** la respuesta incluye la lista completa de ítems con nombre del material, código y cantidad.
3. **Given** un técnico intenta crear una solicitud sin ningún ítem, **When** envía el request, **Then** el sistema rechaza con error de validación (422).
4. **Given** un técnico crea una solicitud con un solo material, **When** la solicitud se guarda, **Then** funciona igual que antes (compatibilidad hacia atrás garantizada).

---

### User Story 2 — Trazabilidad: saber quién aprobó o rechazó una solicitud (Priority: P2)

Un gerente o auditor quiere saber exactamente quién aprobó una solicitud de materiales, cuándo lo hizo y desde qué estado venía. Esto es crítico para auditoría interna y para resolver disputas ("yo no aprobé eso").

**Why this priority**: En un ERP vendible a empresas, la trazabilidad de aprobaciones es un requisito de auditoría. Sin ella, el sistema no es confiable para uso empresarial.

**Independent Test**: Se puede testear aprobando una solicitud y luego consultando su historial: debe aparecer el cambio PENDING → APPROVED con el usuario que lo hizo y la fecha exacta.

**Acceptance Scenarios**:

1. **Given** una solicitud en estado PENDING, **When** un aprobador la aprueba, **Then** se registra automáticamente en el historial: quién lo hizo, a qué hora, y el cambio de estado (PENDING → APPROVED).
2. **Given** una solicitud rechazada después de haber sido aprobada (múltiples cambios), **When** se consulta el historial, **Then** aparece cada cambio en orden cronológico con su actor.
3. **Given** cualquier cambio de estado en una solicitud, **When** ocurre, **Then** el registro de auditoría se crea en la misma transacción (si falla el audit, falla el cambio de estado).
4. **Given** un usuario sin permisos de admin, **When** consulta el historial de auditoría de una solicitud, **Then** solo puede ver el historial de sus propias solicitudes.

---

### User Story 3 — Consultar historial de auditoría de una solicitud (Priority: P3)

Un logístico o gerente quiere consultar el historial completo de una solicitud: cuándo fue creada, cuándo cambió de estado, quién intervino. Esto ayuda a resolver retrasos y responsabilidades.

**Why this priority**: Depende de US2 (el registro). Una vez que se registra el audit trail, este endpoint lo expone.

**Independent Test**: Consultando `GET /requests/{id}/history` después de varios cambios de estado y verificando que la respuesta es una lista cronológica de eventos.

**Acceptance Scenarios**:

1. **Given** una solicitud con historial de cambios, **When** se consulta `GET /requests/{id}/history`, **Then** la respuesta es una lista de eventos ordenada por fecha, mostrando actor, estado anterior, estado nuevo y timestamp.
2. **Given** una solicitud recién creada sin cambios de estado, **When** se consulta su historial, **Then** se devuelve lista vacía (sin errores).

---

### Edge Cases

- ¿Qué pasa si uno de los materiales en la lista no existe en la DB? → Rechazar toda la solicitud con error 422 indicando cuál material es inválido.
- ¿Qué pasa si la cantidad de un ítem es 0 o negativa? → Rechazar con error de validación.
- ¿Qué pasa si se intenta crear una solicitud con materiales duplicados (mismo material dos veces)? → Rechazar o consolidar (decisión: rechazar con error claro, el usuario debe limpiar su lista).
- ¿Qué pasa con solicitudes existentes (single-item con related_material_id) creadas antes de esta feature? → Deben seguir siendo legibles y aparecen en los listados normalmente. Solo las nuevas solicitudes usan ítems.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir crear una solicitud de materiales con uno o más ítems (material + cantidad) en una sola operación.
- **FR-002**: Cada ítem de la solicitud DEBE tener un material válido (existente en el catálogo) y una cantidad positiva mayor a cero.
- **FR-003**: El sistema DEBE rechazar solicitudes con ítems duplicados (mismo material_id más de una vez en la misma solicitud).
- **FR-004**: Las solicitudes existentes de tipo single-item (campo related_material_id) DEBEN seguir siendo legibles y funcionales sin modificación.
- **FR-005**: Al aprobar o rechazar una solicitud, el sistema DEBE registrar automáticamente en el historial: actor (usuario que hizo la acción), estado anterior, estado nuevo, timestamp y fuente (API).
- **FR-006**: El registro de auditoría DEBE crearse en la misma transacción que el cambio de estado. Si el registro falla, el cambio de estado no se aplica.
- **FR-007**: El sistema DEBE exponer un endpoint para consultar el historial de auditoría de una solicitud específica.
- **FR-008**: El endpoint de consulta de solicitud DEBE incluir la lista de ítems con nombre de material, código y cantidad.
- **FR-009**: Solo el creador de la solicitud o un usuario con permiso de aprobación PUEDE consultar el historial de auditoría.

### Key Entities

- **Solicitud (material_requests)**: Cabecera de la solicitud. Tiene estado (PENDING/APPROVED/REJECTED), solicitante, proyecto, fechas. Con esta feature pasa a ser el "header" del pedido.
- **Ítem de solicitud (material_request_items)**: Línea de detalle. Un ítem = un material con una cantidad. Una solicitud tiene 1..N ítems.
- **Historial de auditoría (material_request_audit)**: Registro inmutable de cada cambio de estado. Tiene actor, old_status, new_status, timestamp. Solo crece (INSERT), nunca se modifica.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un solicitante puede incluir hasta 20 materiales en una sola solicitud sin degradación de respuesta.
- **SC-002**: El historial de cada solicitud muestra el nombre del aprobador, el timestamp exacto y el cambio de estado para el 100% de las transiciones ocurridas.
- **SC-003**: Las solicitudes creadas antes de esta feature (single-item) continúan siendo accesibles y visibles en todos los listados existentes sin cambios.
- **SC-004**: Los 13 smoke tests existentes pasan sin ninguna modificación después de implementar esta feature.
- **SC-005**: El registro de auditoría nunca queda desincronizado del cambio de estado (transacción atómica).

---

## Assumptions

- Los permisos de aprobación existentes (`requests:approve` o similar) se reutilizan sin cambio.
- El campo `related_material_id` en `material_requests` se mantiene tal cual para no romper solicitudes legacy. Las nuevas solicitudes multi-item llevan `related_material_id = NULL`.
- El frontend de solicitudes se actualizará en una fase posterior; esta feature es 100% backend.
- La tabla `material_request_items` ya tiene las FK correctas a `material_requests` y `materials`.
- La tabla `material_request_audit` ya tiene FK a `material_requests` y campo `source DEFAULT 'API'`.
- No se requiere migración de datos: las solicitudes históricas single-item no se convierten a multi-item.
