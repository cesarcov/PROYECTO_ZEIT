# Feature Specification: Marca configurable (white-label)

**Feature Branch**: `003-marca-configurable`

**Created**: 2026-06-20

**Status**: Draft

**Input**: User description: "El administrador maestro puede personalizar la identidad del ERP desde el panel (subir/cambiar/quitar logo con variante clara y oscura, cambiar nombre del producto, eslogan y el crédito 'Powered by CeShark'), guardado en el servidor y aplicado en todas las pantallas. Si no hay logo configurado se usa el de ZEIT por defecto. Objetivo: reutilizar el mismo ERP para otra empresa cambiando solo el logo y el nombre. Solo el admin maestro edita; los demás solo ven."

## Clarifications

### Session 2026-06-20

- Q: ¿Quién puede editar la marca ("administrador maestro")? → A: Usuarios con rol admin (`admin:*`).
- Q: ¿Formatos y tamaño máximo de logo? → A: PNG, SVG o JPG, hasta 2 MB.
- Q: ¿El crédito "Powered by CeShark" se puede ocultar? → A: No; siempre visible (fijo, no editable).
- Q: ¿Se incluye favicon + título de la pestaña? → A: Sí.
- Q: ¿Granularidad de los colores corporativos configurables? → A: Un set (primario + acento + acción) aplicado a los 5 temas; los demás tonos (fondos, bordes) se derivan.
- Q: ¿Cómo se muestra el nombre cuando el logo no lo incluye? → A: Una casilla "Mi logo ya incluye el nombre"; si está desmarcada (o no hay logo), se muestra el nombre del producto como texto junto al/ en lugar del logo.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cambiar nombre y eslogan del producto (Priority: P1)

El administrador maestro entra a una sección de "Marca" en el panel de administración, cambia el **nombre del producto** y el **eslogan**, guarda, y el cambio se ve de inmediato en toda la aplicación (login, barra lateral, menús, título de la pestaña).

**Why this priority**: Es el cambio más básico y frecuente del white-label; con solo esto, el ERP ya deja de decir "ZEIT" por todos lados y queda con el nombre de la nueva empresa.

**Independent Test**: Como admin, cambiar el nombre a "ACME ERP", guardar, y verificar que login + barra lateral + pestaña muestran "ACME".

**Acceptance Scenarios**:

1. **Given** soy admin maestro, **When** cambio el nombre del producto y guardo, **Then** el nuevo nombre aparece en login, barra lateral, menús y título de la pestaña.
2. **Given** cambié el eslogan, **When** abro el login, **Then** veo el eslogan nuevo debajo del logo.

---

### User Story 2 - Subir y cambiar el logo (claro y oscuro) (Priority: P1)

El administrador maestro sube el **logo de la empresa** en dos variantes —una para fondos claros y otra para fondos oscuros— y opcionalmente un **isotipo** (versión chica para la barra colapsada). Al guardar, el logo aparece en todas las pantallas, eligiendo automáticamente la variante según el fondo.

**Why this priority**: El logo es el elemento de marca más visible. Junto con US1 completa el rebranding básico para otra empresa.

**Independent Test**: Subir un logo claro y uno oscuro, guardar, y verificar que aparecen en login (panel oscuro → variante oscura) y en una pantalla de fondo claro (→ variante clara).

**Acceptance Scenarios**:

1. **Given** subo un logo para fondo oscuro, **When** abro el login (panel oscuro), **Then** se muestra ese logo.
2. **Given** subo un logo para fondo claro, **When** veo una superficie clara con logo, **Then** se muestra la variante clara.
3. **Given** subo un archivo que no es imagen válida o excede el tamaño permitido, **When** intento guardar, **Then** el sistema lo rechaza con un mensaje claro y conserva el logo anterior.

---

### User Story 3 - Quitar la marca y volver al default (Priority: P2)

El administrador maestro puede **quitar** el logo o el nombre personalizado y el sistema vuelve a la **marca por defecto (ZEIT Solutions)**, sin que ninguna pantalla quede vacía o rota.

**Why this priority**: Da reversibilidad y seguridad: si algo sale mal o se reusa el equipo, se vuelve al estado conocido.

**Independent Test**: Con una marca personalizada activa, pulsar "Restablecer a ZEIT" y verificar que vuelve el logo y nombre ZEIT en toda la app.

**Acceptance Scenarios**:

1. **Given** hay una marca personalizada, **When** elijo "Restablecer marca", **Then** vuelve el logo y nombre ZEIT por defecto.
2. **Given** no hay logo configurado, **When** abro cualquier pantalla, **Then** se ve el logo ZEIT por defecto (nunca un hueco).

---

### User Story 4 - La marca es solo-lectura para los demás (Priority: P2)

Cualquier usuario ve la marca vigente, pero **solo el administrador maestro** puede modificarla. Los demás roles no ven la sección de edición ni pueden cambiarla.

**Why this priority**: La identidad corporativa es sensible; un cambio accidental o malicioso afectaría a toda la organización.

**Independent Test**: Iniciar sesión como un usuario no-admin y verificar que no existe acceso a editar la marca; intentar el cambio por vía directa debe ser rechazado.

**Acceptance Scenarios**:

1. **Given** soy un usuario sin rol admin, **When** busco la configuración de marca, **Then** no está disponible para editar.
2. **Given** un usuario sin permiso intenta cambiar la marca, **When** envía el cambio, **Then** el sistema lo rechaza por falta de autorización.

---

### User Story 5 - Personalizar los colores corporativos (Priority: P2)

El administrador maestro define los **colores corporativos** de la empresa (color **primario**, **acento** y **acción**). El sistema los aplica a los 5 temas (claro, oscuro, etc.) mediante tokens, de modo que la app se sienta "de la empresa" sin perder la estructura de temas; los tonos secundarios (fondos, superficies, bordes) se derivan de esos colores base.

**Why this priority**: Completa el white-label: además del logo y el nombre, la paleta hace que el ERP se sienta propio de cada empresa. Acompaña a la identidad visual.

**Independent Test**: Como admin, cambiar el color primario y el de acento a los de otra empresa, guardar, y verificar que botones, resaltados y navegación activa adoptan esos colores en los temas.

**Acceptance Scenarios**:

1. **Given** soy admin maestro, **When** defino color primario y acento y guardo, **Then** la app aplica esos colores (botones, enlaces, navegación activa) en los temas.
2. **Given** no configuré colores, **When** uso la app, **Then** se usan los colores ZEIT por defecto.
3. **Given** ingreso un color inválido, **When** intento guardar, **Then** el sistema lo rechaza con un mensaje claro y conserva los colores anteriores.

---

### Edge Cases

- **Falta una variante de logo:** si se subió solo el claro (o solo el oscuro), se usa el disponible en ambos fondos hasta que se cargue el otro.
- **Sin isotipo:** si no se sube versión chica, la barra colapsada usa el logo disponible recortado/escalado, sin romperse.
- **Imagen inválida o pesada:** formato no soportado o tamaño excesivo → rechazo con mensaje y se mantiene lo anterior.
- **Propagación del cambio:** al guardar, los usuarios ven la marca nueva en su próxima carga; las sesiones abiertas no quedan en estado inconsistente.
- **Título/favicon:** el nombre y el ícono de la pestaña del navegador también reflejan la marca.
- **Colores de bajo contraste:** si la empresa elige colores que comprometen la legibilidad, el sistema deriva los tonos para mantener un contraste aceptable (o lo advierte), sin dejar texto ilegible.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Solo los usuarios con **rol admin (`admin:*`)** MUST poder ver y editar la configuración de marca; los demás roles MUST verla aplicada pero sin acceso a editarla.
- **FR-002**: El admin MUST poder cambiar el **nombre del producto** y el **eslogan**.
- **FR-003**: El admin MUST poder **subir/cambiar** el **logo para fondo claro** y el **logo para fondo oscuro**, y opcionalmente un **isotipo** (versión chica).
- **FR-004**: El admin MUST poder **quitar/restablecer** la marca a la de **ZEIT por defecto**.
- **FR-005**: La marca vigente MUST aplicarse en **todas las pantallas**: login, barra lateral, menús, y **título de pestaña + favicon**.
- **FR-006**: La configuración de marca MUST guardarse **en el servidor** y verse igual para cualquier usuario y dispositivo (no solo en el navegador del admin).
- **FR-007**: Si no hay logo o nombre configurado, el sistema MUST usar el **valor por defecto (ZEIT Solutions)**; ninguna pantalla queda vacía o rota.
- **FR-008**: El sistema MUST **validar** las imágenes subidas: formatos permitidos **PNG, SVG o JPG** y tamaño máximo **2 MB**. Si no cumplen, rechazarlas con un mensaje claro conservando la marca anterior.
- **FR-009**: El **crédito "Powered by CeShark"** MUST mostrarse **siempre** (atribución fija del desarrollador); no es ocultable ni editable.
- **FR-010**: La variante de logo MUST elegirse automáticamente según el fondo (clara para superficies claras, oscura para superficies oscuras).
- **FR-011**: El admin MUST poder definir los **colores corporativos** de la empresa: al menos **primario**, **acento** y **acción**.
- **FR-012**: Los colores corporativos configurados MUST aplicarse a los **5 temas** mediante tokens; los tonos no definidos (fondos, superficies, bordes) se derivan manteniendo legibilidad/contraste.
- **FR-013**: Si no hay colores configurados, MUST usarse la **paleta ZEIT por defecto**. Los valores de color se validan y, si son inválidos, se rechazan conservando los anteriores.
- **FR-014**: El admin MUST poder indicar si **el logo ya incluye el nombre**. Si NO lo incluye (o no hay logo cargado), el sistema MUST mostrar el **nombre del producto como texto** (junto al isotipo, o solo el texto si no hay logo); nunca debe quedar el nombre "ZEIT" cuando hay otra marca configurada.

### Key Entities

- **Configuración de marca** (única, global): nombre del producto, eslogan, indicador **"el logo incluye el nombre"** (sí/no), referencia al logo claro, al logo oscuro, al isotipo, al favicon, y los **colores corporativos** (primario, acento, acción). Una sola por instalación del ERP. El crédito "Powered by CeShark" es fijo (no forma parte de la configuración editable).
- **Imagen de marca**: archivo de imagen subido (logo claro / oscuro / isotipo / favicon), con formato y tamaño validados.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un administrador maestro cambia el nombre del producto y lo ve reflejado en toda la app en **menos de 1 minuto**, sin tocar código.
- **SC-002**: Tras subir un logo, aparece en login, barra lateral y menús el **100%** de las veces, eligiendo la variante correcta según el fondo.
- **SC-003**: Un usuario sin rol admin tiene **0** formas de modificar la marca (ni UI ni por envío directo).
- **SC-004**: "Restablecer marca" vuelve al default ZEIT el **100%** de las veces, sin pantallas rotas.
- **SC-005**: Reutilizar el ERP para otra empresa (nombre + logo claro + logo oscuro) toma **menos de 5 minutos** y **0 cambios de código**.

## Assumptions

- **Una sola marca global** por instalación (no multi-empresa simultánea / multi-tenant; eso queda fuera de alcance).
- **"Administrador maestro"** = usuarios con rol **admin (`admin:*`)**. *(Confirmado en Clarifications.)*
- **Formatos de logo**: **PNG, SVG o JPG**, preferentemente con fondo transparente; tamaño máximo **2 MB**. *(Confirmado en Clarifications.)*
- Si falta una variante (claro u oscuro), se usa la disponible en ambos fondos.
- El **isotipo** y el **favicon** son opcionales; si no se cargan, se derivan del logo o se usa el default.
- La **marca por defecto** es ZEIT Solutions (ya incluida en el producto, feature 002).
- Se **reutiliza el panel de administración** existente para alojar la sección "Marca".
- Construye sobre la base de la feature 002: hoy la identidad se lee de una config local; esta feature hace que esa config provenga del **servidor** y sea editable por el admin.
- Los **colores corporativos** se configuran como un set (primario, acento, acción) y **reemplazan** la paleta ZEIT por defecto en todos los temas; los demás tonos se derivan. La regla de la constitución "naranja nunca como color principal" aplica a la **marca ZEIT por defecto**; otra empresa define libremente su propio color primario/acento.
