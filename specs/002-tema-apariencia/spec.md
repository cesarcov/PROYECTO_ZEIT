# Feature Specification: Sistema de temas (apariencia) configurable — ZEIT Solutions

**Feature Branch**: `002-tema-apariencia`

**Created**: 2026-06-19

**Status**: Draft

**Input**: User description: "Sistema de temas configurable por usuario al estilo VS Code (claro/oscuro), aplicado al instante y recordado entre sesiones, usando los colores corporativos oficiales de ZEIT Solutions vía tokens, con la identidad ZEIT (logo globo+onda) como marca principal y 'Powered by CeShark · ERP Engine' en segundo plano."

## Clarifications

### Session 2026-06-19

- Q: ¿Tema por defecto para un usuario sin preferencia guardada? → A: Seguir el tema del sistema operativo (claro/oscuro), con opción de fijarlo manualmente (estilo VS Code).
- Q: ¿Dónde se recuerda la preferencia de tema? → A: En la cuenta del usuario (se restaura en cualquier dispositivo).
- Q: ¿Alcance de la migración a tokens en esta feature? → A: Por tramos. ESTA feature entrega el motor de 5 temas + tokens + persistencia + el armazón global (barra lateral, encabezado, footer, login) y Preferencias; la migración del resto de vistas (~70) se entrega en features siguientes por módulos.
- Q: ¿Cuántos temas y con qué regla de color? → A: 5 temas (los 3 de los mockups + 2 nuevos a definir). Regla transversal: el Naranja Energía nunca es color principal; se usa solo como acento/acción.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Elegir modo claro u oscuro y verlo al instante (Priority: P1)

Cualquier usuario del ERP entra a sus preferencias de apariencia, elige entre **modo claro** y **modo oscuro**, y la interfaz completa cambia de inmediato, sin recargar la página ni cerrar sesión.

**Why this priority**: Es el corazón del pedido. Quien trabaja muchas horas (oficina luminosa vs. turno nocturno en planta) necesita una apariencia cómoda. Entregar solo esto ya es un MVP con valor real.

**Independent Test**: Entrar a preferencias, alternar claro↔oscuro, y verificar que toda la pantalla (barra lateral, encabezado, tarjetas, tablas) cambia al instante.

**Acceptance Scenarios**:

1. **Given** estoy en modo claro, **When** elijo "modo oscuro", **Then** toda la interfaz visible adopta el tema oscuro inmediatamente, sin recargar.
2. **Given** estoy en modo oscuro, **When** elijo "modo claro", **Then** la interfaz vuelve al tema claro inmediatamente.
3. **Given** cualquier tema activo, **When** navego a otra sección del ERP, **Then** el tema se mantiene consistente en toda la app.

---

### User Story 2 - Que el sistema recuerde mi tema (Priority: P1)

Una vez que elijo un tema, el sistema lo recuerda: si cierro sesión y vuelvo a entrar (o entro otro día), la app abre con el tema que dejé elegido, sin tener que volver a configurarlo.

**Why this priority**: Sin persistencia, la función es una molestia (reconfigurar cada vez). Junto con US1 forma el MVP utilizable.

**Independent Test**: Elegir un tema, cerrar sesión, volver a iniciar sesión y verificar que la app abre con ese mismo tema.

**Acceptance Scenarios**:

1. **Given** elegí "modo oscuro", **When** cierro sesión y vuelvo a entrar, **Then** la app abre en modo oscuro.
2. **Given** un usuario nuevo sin preferencia previa, **When** entra por primera vez, **Then** recibe un tema por defecto coherente (ver Assumptions) y puede cambiarlo.

---

### User Story 3 - Identidad visual ZEIT Solutions consistente (Priority: P2)

En cualquier tema, la aplicación se presenta con la identidad de **ZEIT Solutions** (logo del globo + onda y el nombre "ZEIT SOLUTIONS") como marca principal, y el crédito **"Powered by CeShark · ERP Engine"** en segundo plano (pantalla de login y footer). Todos los colores provienen de la paleta corporativa oficial.

**Why this priority**: El producto es para ZEIT Solutions; su marca debe dominar y los colores corporativos deben verse profesionales en ambos temas. El crédito al desarrollador queda discreto.

**Independent Test**: Revisar login y footer (logo + "Powered by CeShark") y confirmar, en claro y oscuro, que los colores corresponden a la paleta ZEIT.

**Acceptance Scenarios**:

1. **Given** la pantalla de login, **When** la observo, **Then** veo el logo y nombre ZEIT Solutions como marca principal y "Powered by CeShark · ERP Engine" en segundo plano.
2. **Given** cualquier pantalla interna, **When** miro el footer/barra lateral, **Then** la marca ZEIT es la principal y el crédito CeShark es secundario.
3. **Given** modo claro u oscuro, **When** comparo los colores, **Then** corresponden a la paleta corporativa (azul, azul oscuro, turquesa, naranja, gris).

---

### Edge Cases

- **Usuario sin preferencia previa:** recibe el tema por defecto definido por el sistema (ver Assumptions), nunca una pantalla sin estilo.
- **Legibilidad:** en ambos temas, el texto y los elementos clave deben mantener contraste suficiente para uso prolongado (objetivo de accesibilidad).
- **Pantallas aún no migradas a tokens:** mientras la migración avanza por fases, ninguna pantalla debe quedar ilegible o "rota" en modo oscuro; las áreas fuera del alcance inicial mantienen una apariencia aceptable.
- **Cambio de tema con trabajo en curso:** alternar el tema no debe perder datos ni interrumpir formularios abiertos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El usuario MUST poder elegir el tema de apariencia entre los **5 temas del catálogo** (ver FR-011) desde sus preferencias.
- **FR-002**: El cambio de tema MUST aplicarse de inmediato a toda la interfaz visible, sin recargar la página ni cerrar sesión.
- **FR-003**: La preferencia de tema MUST guardarse en la **cuenta del usuario** y restaurarse en cualquier dispositivo o sesión.
- **FR-004**: Todos los colores de la interfaz dentro del alcance MUST derivar de la paleta corporativa oficial de ZEIT Solutions (Azul `#003A8C`, Azul Oscuro `#001F54`, Turquesa `#00D4D8`, Naranja `#FF6B00`, Gris `#5A6573`) mediante tokens/variables, no colores fijos por componente.
- **FR-005**: La interfaz MUST presentar a **ZEIT Solutions** (logo globo+onda y nombre) como marca principal, y el crédito **"Powered by CeShark · ERP Engine"** en segundo plano (login y footer).
- **FR-006**: Ambos temas MUST mantener legibilidad y contraste suficientes para texto y elementos clave (objetivo WCAG AA).
- **FR-007**: Un usuario sin preferencia previa MUST recibir, por defecto, el tema acorde al **sistema operativo** (claro/oscuro), con la posibilidad de fijarlo manualmente.
- **FR-008**: El selector de tema MUST indicar claramente cuál es el tema activo (idealmente con vista previa).
- **FR-009**: En esta feature, la migración a tokens MUST cubrir el **motor de temas** y el **armazón global** (barra lateral, encabezado, footer, pantalla de login) y la página de Preferencias. Las vistas de módulo restantes se migran en features siguientes; mientras tanto, ninguna pantalla debe quedar ilegible o rota en ningún tema.
- **FR-010**: El **Naranja Energía** (`#FF6B00`) MUST usarse únicamente como color de **acción / acento / alerta**; NUNCA como color principal de marca ni de superficies grandes, en ningún tema (por su alta saturación).
- **FR-011**: El sistema MUST ofrecer **5 temas** nombrados, todos derivados de la paleta corporativa vía tokens:
    1. **ZEIT Claro** — base clara; primario Azul Corporativo `#003A8C`, acento Turquesa `#00D4D8`.
    2. **ZEIT Oscuro** — base Azul Oscuro `#001F54`/navy profundo, texto claro; primario Azul/Turquesa.
    3. **ZEIT Oscuro Energía** — variante oscura con el Naranja como **acento** de navegación activa y acciones (como el mockup); el naranja no es fondo ni primario.
    4. **ZEIT Turquesa** (nuevo) — base clara-media con el Turquesa como acento dominante y Azul como primario; aire tecnológico/fresco.
    5. **ZEIT Grafito** (nuevo) — base gris grafito (Gris Industrial `#5A6573` atenuado), sobrio y de alto contraste; primario Azul, acento Turquesa.

### Key Entities

- **Preferencia de apariencia del usuario**: el tema elegido por una persona (y, si aplica, su acento). Asociada a la cuenta del usuario; una por usuario.
- **Tema**: conjunto nombrado de **tokens** de color (fondo, superficie, texto, bordes, acento, estados) derivados de la paleta corporativa ZEIT. Existen **5 temas** nombrados (ver FR-011).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un usuario cambia de tema en **2 clics o menos** desde sus preferencias y lo ve aplicado en **menos de 1 segundo**.
- **SC-002**: Tras cerrar sesión y volver a entrar, el último tema elegido se restaura el **100%** de las veces.
- **SC-003**: En ambos temas, el texto principal cumple un contraste legible (objetivo **WCAG AA**, ratio ≥ 4.5:1 para texto normal).
- **SC-004**: La marca **ZEIT Solutions** aparece como identidad principal en el **100%** de las pantallas; "Powered by CeShark" visible en login y footer.
- **SC-005**: En el **alcance de esta feature** (motor + armazón + Preferencias), **0 colores hardcodeados** fuera de tokens (verificable por revisión de código).
- **SC-006**: El usuario puede elegir entre **5 temas**; en ninguno el Naranja Energía aparece como color principal de marca o de superficies grandes.

## Assumptions

- **Temas:** 5 temas nombrados (ver FR-011). El **Naranja Energía** es siempre acento/acción, nunca principal (FR-010). Los 2 temas nuevos (ZEIT Turquesa, ZEIT Grafito) se diseñan a partir de la paleta corporativa; los valores exactos de cada token se afinan en el plan/diseño.
- **Tema por defecto** (usuario sin preferencia): seguir el tema del sistema operativo, con opción de fijarlo manualmente (estilo VS Code). *(Confirmado en Clarifications.)*
- **Dónde se recuerda:** la preferencia se guarda en la **cuenta del usuario** (se restaura en cualquier dispositivo). *(Confirmado en Clarifications.)*
- **Alcance (por tramos):** esta feature entrega el motor de 5 temas + tokens + persistencia + el **armazón** (sidebar, header, footer, login) y Preferencias, con la marca ZEIT aplicada al armazón. La migración del resto de vistas (~70) y de cadenas/logos "CeShark"→ZEIT se entrega en features siguientes por módulos. *(Refinado en Clarifications.)*
- **Ubicación del selector:** se reutiliza la página de **Preferencias** del usuario ya existente.
- **Assets de marca:** ZEIT Solutions provee el logo (globo + onda) en PNG; el crédito usa "Powered by CeShark · ERP Engine".
