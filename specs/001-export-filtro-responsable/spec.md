# Feature Specification: Filtrar el Exportar de Planificación por responsable

**Feature Branch**: `001-export-filtro-responsable`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "El botón Exportar de Planificación debe permitir filtrar también por responsable, además de los filtros de fecha, prioridad, estado y cliente que ya tiene."

## Clarifications

### Session 2026-06-19

- Q: ¿El filtro de responsable del export selecciona un solo responsable a la vez o varios? → A: Uno a la vez (selección simple), coherente con el filtro de responsable que el tablero ya tiene.
- Q: ¿Se incluye la opción "sin responsable asignado" dentro del filtro? → A: Sí, se incluye.
- Q: ¿El selector lista todos los usuarios o solo los presentes en la planificación? → A: Todos los usuarios (reutiliza la lista del filtro del tablero). *(Decidido en /speckit-analyze.)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Exportar solo las tareas de un responsable (Priority: P1)

Un gestor de planificación abre la vista de Planificación semanal, elige a una persona en el filtro de responsable y exporta. El archivo descargado contiene únicamente las tareas asignadas a esa persona, respetando además cualquier otro filtro activo (fecha, prioridad, estado, cliente).

**Why this priority**: Es el corazón del pedido. Hoy un gestor que quiere "la carga de trabajo de Juan" tiene que exportar todo y filtrar a mano en Excel. Resolver esto entrega valor inmediato y es un MVP por sí solo.

**Independent Test**: Con tareas de varios responsables en la planificación, seleccionar un responsable y exportar; verificar que el Excel resultante solo incluye filas de esa persona.

**Acceptance Scenarios**:

1. **Given** hay tareas asignadas a distintos responsables, **When** el gestor selecciona el responsable "X" y exporta, **Then** el archivo contiene únicamente tareas cuyo responsable es X.
2. **Given** el gestor no selecciona ningún responsable, **When** exporta, **Then** el archivo incluye tareas de todos los responsables (comportamiento actual, sin cambios).
3. **Given** el filtro de responsable se combina con filtros de fecha, prioridad, estado o cliente, **When** exporta, **Then** el resultado cumple TODOS los filtros a la vez (intersección).

---

### User Story 2 - Tareas con varios responsables (Priority: P2)

Una tarea de planificación puede tener más de un responsable. Al filtrar por una persona, la tarea debe aparecer si esa persona es uno de sus responsables, aunque no sea el único.

**Why this priority**: El módulo de Planificación ya admite múltiples responsables por tarea. Sin contemplar este caso, el filtro daría resultados incompletos y el gestor perdería tareas compartidas.

**Independent Test**: Crear una tarea asignada a dos personas (X e Y); filtrar por Y y comprobar que la tarea aparece en el export.

**Acceptance Scenarios**:

1. **Given** una tarea con responsables X e Y, **When** se filtra por Y, **Then** la tarea aparece en el export.
2. **Given** una tarea con un único responsable X, **When** se filtra por Y, **Then** la tarea NO aparece en el export.

---

### User Story 3 - Detectar tareas sin responsable asignado (Priority: P3)

Un gestor quiere ver qué tareas aún no tienen a nadie asignado, para repartir el trabajo. Puede elegir la opción "sin responsable asignado" y exportar solo esas.

**Why this priority**: Útil para la gestión de huecos, pero no es el núcleo del pedido. Confirmado dentro del alcance (ver Clarifications).

**Independent Test**: Con tareas asignadas y otras sin asignar, elegir "sin responsable" y verificar que el export solo trae las no asignadas.

**Acceptance Scenarios**:

1. **Given** hay tareas con y sin responsable, **When** se elige "sin responsable asignado", **Then** el export contiene solo las tareas sin responsable.

---

### Edge Cases

- **El responsable elegido no tiene tareas (o ninguna cumple los demás filtros):** el export se genera igual, como archivo válido con solo las cabeceras; nunca un error ni una pantalla en blanco.
- **Una tarea tiene asignado a alguien ya inactivo/eliminado:** la tarea conserva su asignación histórica y sigue apareciendo si coincide con el responsable buscado.
- **Coincidencia exacta vs. parcial:** el filtro de responsable identifica a una persona concreta de una lista (coincidencia por identidad), no por texto libre — a diferencia del filtro de "cliente" que hoy usa coincidencia parcial.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El Exportar de Planificación MUST aceptar un filtro opcional por responsable, sumándose a los filtros actuales (fecha inicio, fecha fin, prioridad, estado, cliente).
- **FR-002**: Cuando se especifica un responsable, el archivo exportado MUST incluir únicamente las tareas asignadas a esa persona.
- **FR-003**: El filtro de responsable MUST combinarse con los demás filtros como intersección: una tarea aparece solo si cumple TODOS los filtros aplicados.
- **FR-004**: Cuando NO se especifica responsable, el comportamiento MUST ser idéntico al actual (todas las tareas, sujeto al resto de filtros). Sin regresiones.
- **FR-005**: Para tareas con múltiples responsables, la tarea MUST incluirse si el responsable filtrado es uno de sus responsables asignados.
- **FR-006**: El sistema MUST ofrecer los responsables en una lista seleccionable (no texto libre propenso a errores), reutilizando la misma lista de usuarios que ya alimenta el filtro de responsable del tablero.
- **FR-007**: El sistema MUST permitir filtrar las tareas "sin responsable asignado" como una opción del propio filtro.
- **FR-008**: El archivo exportado MUST mantener el mismo formato, las mismas columnas (incluida la columna "Responsable" ya existente) y el mismo nombre de archivo; lo único que cambia es el conjunto de filas según el filtro.

### Key Entities

- **Tarea de Planificación**: una fila de la planificación semanal. Atributos relevantes para esta feature: prioridad, estado, cliente, fechas (solicitud y límite) y uno, varios o ningún responsable.
- **Responsable**: persona asignada a una tarea. Una tarea puede tener uno, varios o ninguno; la misma persona puede ser responsable de muchas tareas.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un gestor puede generar un export filtrado por responsable en 3 clics o menos desde la vista de Planificación, sin manipular el archivo después.
- **SC-002**: Un export filtrado por el responsable "X" contiene el 100% de las tareas que incluyen a X (y cumplen los demás filtros) y 0% de las tareas que no incluyen a X.
- **SC-003**: Al no elegir responsable, el contenido del export es idéntico al del export actual con los mismos filtros (cero regresiones).
- **SC-004**: Exportar sin coincidencias nunca produce un error; entrega un archivo válido (vacío de datos) el 100% de las veces.

## Assumptions

- Se filtra por **un único responsable a la vez** (selección simple), coherente con el filtro de responsable que el tablero ya tiene. *(Confirmado en Clarifications.)*
- La coincidencia es **por identidad (id)** del responsable elegido de una lista, igual que el filtro de columna actual del tablero, no por texto libre.
- La opción **"sin responsable asignado"** está **incluida** en el alcance (FR-007). *(Confirmado en Clarifications.)*
- El alcance es **solo el export de actividades de Planificación** (la acción Exportar del tablero semanal). El export de "productividad" queda fuera de esta feature.
- Se **reutilizan** la columna "Responsable" y el formato de Excel ya existentes; no se rediseña el archivo.
- El **permiso/rol** requerido para exportar no cambia: mismo control de acceso que hoy tiene la vista de Planificación.
