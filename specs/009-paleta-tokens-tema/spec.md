# Feature Specification: Sistema de Paleta Corporativa y Tokens de Tema

**Feature Branch**: `009-paleta-tokens-tema`

**Created**: 2026-07-05

**Status**: Draft

**Input**: User description: "Utilizar los colores corporativos, 4 tokens editables (no 3),
temas claro y oscuro equilibrados — no todo oscuro ni todo claro — look sobrio y profesional."

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Usuario cambia de tema y ve contraste correcto (Priority: P1)

Un usuario del ERP (cualquier rol) abre la pantalla de preferencias y selecciona
el tema "Oscuro". La interfaz cambia inmediatamente: el fondo usa el Azul Oscuro
corporativo, pero los paneles de contenido usan un gris medio (no negro puro),
y todo el texto que se superpone sobre fondos oscuros es near-white — perfectamente
legible a simple vista.

**Why this priority**: Es la experiencia diaria del usuario. Si el contraste falla,
el ERP se vuelve ilegible. Es el contrato de usabilidad más básico.

**Independent Test**: Abrir la app, ir a Preferencias, cambiar a "Oscuro",
navegar a cualquier módulo (Dashboard, Logística, Operaciones) y verificar
que el texto sea legible sin esfuerzo en todos los elementos.

**Acceptance Scenarios**:

1. **Given** el usuario está en tema "Claro", **When** selecciona "Oscuro" en Preferencias, **Then** la UI cambia sin recargar y el fondo principal pasa a Azul Oscuro (`#001F54`) con texto near-white.
2. **Given** el tema activo es "Oscuro", **When** el usuario navega a cualquier módulo, **Then** todos los textos de cuerpo, etiquetas y valores de tabla tienen ratio de contraste ≥ 4.5:1 sobre su fondo.
3. **Given** el usuario cierra sesión y vuelve a entrar, **When** la sesión se restaura, **Then** el tema elegido se aplica automáticamente sin que el usuario deba elegirlo de nuevo.

---

### User Story 2 - Administrador configura 4 colores corporativos de la empresa (Priority: P1)

El administrador de ZEIT SOLUTIONS (o de una empresa white-label) abre la sección
de Branding y encuentra 4 campos de color editables: Primario, Acento, Acción y
Texto Secundario. Cambia el color Primario a su azul corporativo, guarda y toda
la UI (encabezados, sidebar, botones primarios) refleja inmediatamente el nuevo
color.

**Why this priority**: Es la personalización central del white-label. Tener 4 tokens
da suficiente control para definir una identidad visual completa sin abrumar al
administrador.

**Independent Test**: Abrir Admin → Branding, cambiar los 4 colores a valores de prueba,
guardar y verificar que la UI principal refleje los cambios en tiempo real.

**Acceptance Scenarios**:

1. **Given** el admin está en Admin → Branding, **When** edita los 4 tokens de color, **Then** el sistema muestra una vista previa en tiempo real antes de guardar.
2. **Given** el admin guarda una paleta con combinación válida (contraste ≥ 4.5:1), **When** cualquier usuario recarga la app, **Then** ve los nuevos colores corporativos en toda la UI.
3. **Given** el admin intenta guardar una combinación de colores inválida (texto claro sobre fondo claro o texto oscuro sobre fondo oscuro), **When** presiona "Guardar", **Then** el sistema muestra una advertencia de contraste insuficiente y bloquea el guardado hasta que el problema se corrija.

---

### User Story 3 - Usuario percibe equilibrio visual: sobrio y profesional (Priority: P2)

Un nuevo usuario ingresa al ERP por primera vez en tema "Claro". En lugar de ver
una pantalla completamente blanca, el sidebar usa un tono suave del azul corporativo,
las tarjetas tienen sombra sutil y el fondo de contenido es un gris muy claro (no
blanco puro). El resultado parece un ERP empresarial serio — no una app de
consumo masivo ni una pantalla de hospital.

**Why this priority**: La primera impresión define la percepción de calidad del ERP.
Un look equilibrado reduce fatiga visual y refuerza la confianza del usuario.

**Independent Test**: Mostrar el ERP a alguien que no lo conoce y pedirle que describa
la apariencia. El resultado esperado es "profesional" o "de software empresarial" —
no "demasiado serio" ni "muy básico".

**Acceptance Scenarios**:

1. **Given** el tema activo es "Claro", **When** el usuario navega al Dashboard, **Then** el fondo de contenido es `#F8FAFC` (no blanco puro `#FFFFFF`), el sidebar usa el color primario con intensidad reducida, y los encabezados usan el azul corporativo.
2. **Given** el tema activo es "Oscuro", **When** el usuario navega al Dashboard, **Then** el fondo principal es el Azul Oscuro `#001F54`, los paneles de contenido son `#0D2545` (ligeramente más claro), y ningún fondo es negro puro `#000000`.
3. **Given** cualquier tema activo, **When** el usuario interactúa con botones primarios, **Then** el botón usa el color de Acción (Naranja Energía en default ZEIT) y el texto sobre él es blanco, siempre con contraste ≥ 4.5:1.

---

### User Story 4 - Cambio de tema en vivo: sin parpadeo ni pérdida de estado (Priority: P3)

El usuario trabaja en una cotización a mitad de edición y decide cambiar de tema.
Al seleccionar "Oscuro" desde el menú de usuario (sin abrir Preferencias completo),
los colores cambian en menos de 300ms y el formulario que estaba editando sigue
exactamente en el mismo estado.

**Why this priority**: El cambio de tema no debe interrumpir el flujo de trabajo.

**Independent Test**: Abrir un formulario con datos ingresados a mitad, cambiar el tema
desde el quick-toggle del header, y verificar que los datos y el scroll position
se mantienen.

**Acceptance Scenarios**:

1. **Given** el usuario tiene un formulario abierto con datos ingresados, **When** cambia el tema desde el ícono rápido en el header, **Then** el tema cambia en < 300ms y todos los datos del formulario persisten.
2. **Given** el usuario cambia el tema, **When** la transición ocurre, **Then** no hay flash of unstyled content (FOUC) ni parpadeo blanco/negro intermedio.

---

### Edge Cases

- ¿Qué pasa si el usuario configura un color primario muy oscuro en modo claro? → El sistema calcula si el contraste del texto sobre ese fondo es suficiente y advierte.
- ¿Qué pasa si el token `--text-primary` resulta en bajo contraste por una configuración white-label? → El sistema muestra advertencia y no permite guardar.
- ¿Qué pasa si el usuario tiene una pantalla de alto brillo o pantalla oscura sin calibrar? → Los valores de contraste WCAG 4.5:1 cubren el rango práctico de pantallas.
- ¿Qué pasa si el administrador resetea la paleta? → Se restauran los colores corporativos ZEIT por defecto.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ofrecer exactamente **dos temas de preferencia**: `claro` y `oscuro`. No se exponen otras opciones al usuario final.
- **FR-002**: La pantalla de Branding (Admin) MUST exponer exactamente **4 tokens de color editables**:
  - **Primario** — color de marca principal (sidebar, encabezados, elementos de navegación)
  - **Acento** — color secundario (badges, tags, iconos de estado)
  - **Acción** — color de CTAs y botones primarios
  - **Texto Secundario** — color de textos auxiliares, placeholders y bordes
- **FR-003**: Los **valores por defecto** de los 4 tokens MUST ser la paleta corporativa ZEIT:
  - Primario: `#003A8C` (Azul Corporativo)
  - Acento: `#00D4D8` (Turquesa Tecnológico)
  - Acción: `#FF6B00` (Naranja Energía)
  - Texto Secundario: `#5A6573` (Gris Industrial)
- **FR-004**: El sistema MUST aplicar el **fondo oscuro del Azul Oscuro** (`#001F54`) en el tema oscuro para las superficies principales (layout base); los paneles de contenido usan una capa `#0D2545` (una parada más clara) para dar profundidad sin llegar a negro puro.
- **FR-005**: El sistema MUST aplicar un **fondo claro equilibrado** en tema claro: la superficie de contenido es `#F8FAFC` (no blanco puro), el sidebar usa el color primario con opacidad reducida.
- **FR-006**: Todos los textos principales sobre fondos oscuros MUST usar near-white (`#E8EEF9` o `#F0F4FF`), y sobre fondos claros MUST usar near-black (`#1A2332` o `#111827`), garantizando ratio ≥ 4.5:1 en ambos casos.
- **FR-007**: El sistema MUST **validar el contraste** al guardar una paleta personalizada. Si alguna combinación de color de fondo + color de texto no alcanza ratio 4.5:1, el sistema MUST mostrar una advertencia clara y bloquear el guardado.
- **FR-008**: La preferencia de tema (claro/oscuro) MUST persisitirse **por usuario** en el backend y restaurarse automáticamente en cada inicio de sesión.
- **FR-009**: El cambio de tema MUST aplicarse **sin recargar la página** y en menos de 300ms, preservando el estado de los formularios y la posición de scroll.
- **FR-010**: Los 4 tokens de color MUST distribuirse como **variables CSS** (`--color-primary`, `--color-accent`, `--color-action`, `--color-text-secondary`) disponibles globalmente. Ningún componente puede usar valores hex literales fuera de la definición de estos tokens.
- **FR-011**: El sistema MUST proveer un botón **"Restaurar valores por defecto"** en la pantalla de Branding que restablece los 4 tokens a la paleta corporativa ZEIT sin confirmación adicional.

### Key Entities

- **Token de Color**: Nombre semántico (`primario`, `acento`, `accion`, `texto-secundario`) + valor hex + descripción de uso. Almacenado en la tabla `branding`.
- **Tema Activo**: Preferencia persistida por usuario (`light` / `dark`). Almacenada en preferencias de usuario.
- **Paleta por Defecto ZEIT**: Los 4 valores hex corporativos hardcodeados en el código como fallback cuando `branding` no tiene valor configurado.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El usuario puede cambiar de tema y ver el resultado en menos de 300ms, sin parpadeo ni pérdida de datos en formularios abiertos.
- **SC-002**: El administrador puede configurar los 4 tokens de color en menos de 2 minutos desde la pantalla de Branding.
- **SC-003**: El 100% de los textos principales sobre cualquier fondo (en ambos temas y con cualquier paleta guardada) cumplen ratio de contraste ≥ 4.5:1 — verificable con herramienta WCAG.
- **SC-004**: Un usuario nuevo que vea el ERP por primera vez describe la apariencia como "profesional" o "empresarial" (no "oscuro y agresivo" ni "demasiado plano") — validado informalmente con al menos 3 revisores.
- **SC-005**: El sistema bloquea el 100% de los intentos de guardar paletas con contraste insuficiente, mostrando advertencia antes de que el error llegue a producción.
- **SC-006**: La preferencia de tema se restaura correctamente en el 100% de los inicios de sesión, sin que el usuario deba volver a elegirlo.

---

## Assumptions

- La tabla `branding` existente (1 fila, singleton) se reutiliza y se amplían sus columnas para almacenar los 4 tokens de color si es necesario; se agrega una migración mínima.
- El cálculo de ratio de contraste WCAG se implementa en el frontend (fórmula luminancia relativa), sin llamada al backend.
- El tema oscuro del sidebar ya usa una variante del color primario; esta feature estandariza el comportamiento en lugar de rediseñarlo desde cero.
- El "Gris Industrial" (`#5A6573`) como token "Texto Secundario" aplica solo en tema claro; en tema oscuro el texto secundario toma automáticamente un tono más claro (`#9AAFC5`) para mantener contraste.
- La feature no modifica la pantalla de Preferencias de usuario más allá del toggle claro/oscuro (ya existente o a unificar con el quick-toggle del header).
- Las pruebas de contraste se corren manualmente con herramienta tipo "WebAIM Contrast Checker"; no se implementa CI automatizado de contraste en esta versión.
