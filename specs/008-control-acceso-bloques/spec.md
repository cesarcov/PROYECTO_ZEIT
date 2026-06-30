# Feature Specification: Control de Acceso por Bloques (Superadmin)

**Feature Branch**: `008-control-acceso-bloques`

**Created**: 2026-06-30

**Status**: Draft

**Input**: El superadmin (TI) necesita una UI para asignar bloques de acceso
(Operaciones, Administración, Logística, Gerencia) a cada usuario, con nivel
view o edit por bloque. Además, corregir el bug de ghost buttons: si el usuario
no tiene un bloque asignado, el elemento de navegación no debe renderizarse —
no debe aparecer en su dashboard del lado izquierdo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Eliminar Ghost Buttons del Dashboard (Priority: P1)

Como usuario del ERP, cuando inicio sesión solo debo ver en mi barra lateral izquierda
y en mi dashboard los bloques a los que tengo acceso asignado. Si no tengo asignado
el bloque "Gerencia", ese ítem no existe en mi pantalla — no aparece gris, no aparece
bloqueado, simplemente no está.

**Why this priority**: Es el bug que causa mayor confusión operativa hoy: los usuarios
hacen clic en un botón visible y reciben "acceso denegado". Genera llamadas al TI y
bloquea el trabajo diario. Es el fix más urgente y de mayor impacto inmediato.

**Independent Test**: Se puede verificar iniciando sesión con un usuario que solo tenga
asignado el bloque "Logística" y confirmando que el sidebar y el dashboard solo muestran
ese bloque. No se necesita ninguna otra historia para validar esto.

**Acceptance Scenarios**:

1. **Given** un usuario con solo el bloque "Logística" asignado,
   **When** inicia sesión y ve su dashboard,
   **Then** únicamente aparece "Logística" en el sidebar izquierdo y en las tarjetas
   del dashboard; "Operaciones", "Administración" y "Gerencia" no existen en el DOM.

2. **Given** un usuario sin ningún bloque asignado,
   **When** inicia sesión,
   **Then** el dashboard muestra un mensaje claro como "No tienes módulos asignados.
   Contacta a tu administrador (TI)." y el sidebar izquierdo está vacío.

3. **Given** un usuario con bloque "Administración" en nivel "ver",
   **When** accede al área de Administración,
   **Then** puede consultar y navegar, pero los botones de crear/editar/eliminar
   no existen en pantalla (no están deshabilitados: no están renderizados).

4. **Given** un usuario con bloque "Administración" en nivel "editar",
   **When** accede al área de Administración,
   **Then** puede crear, editar y eliminar dentro del bloque normalmente.

---

### User Story 2 — Superadmin Asigna Bloques a Usuarios (Priority: P2)

Como superadmin (TI), necesito una pantalla de gestión donde pueda seleccionar
cualquier usuario del sistema y asignarle o revocarle bloques de acceso, especificando
para cada bloque si el nivel es "ver" (solo lectura) o "editar" (lectura + escritura).

**Why this priority**: Sin esta UI, el TI no puede configurar correctamente los accesos
y cualquier atascamiento requiere intervención directa en base de datos. Es el motor
de control que da sentido a toda la feature.

**Independent Test**: Puede verificarse creando un usuario de prueba, asignándole el
bloque "Operaciones" con nivel "editar" desde la UI de superadmin, y confirmando que
el usuario ahora ve ese bloque en su dashboard y puede hacer operaciones de escritura.

**Acceptance Scenarios**:

1. **Given** el superadmin accede a la sección de gestión de usuarios,
   **When** selecciona un usuario específico,
   **Then** ve el panel de "Bloques de Acceso" con los 4 bloques listados y el estado
   actual de cada uno (sin asignar / ver / editar).

2. **Given** el superadmin está en el panel de bloques de un usuario,
   **When** activa el bloque "Gerencia" y selecciona nivel "ver" y guarda,
   **Then** el sistema registra la asignación y la confirmación es inmediata;
   el usuario afectado verá el bloque en su próxima navegación.

3. **Given** el superadmin revoca el bloque "Logística" de un usuario que lo tenía,
   **When** guarda el cambio,
   **Then** el bloque "Logística" desaparece del sidebar del usuario afectado
   en su próxima carga de página (sin necesidad de cerrar sesión).

4. **Given** el superadmin accede a su propio perfil,
   **When** intenta revocar sus propios bloques,
   **Then** el sistema no permite esta acción o la ignora, ya que el superadmin
   siempre tiene acceso total independientemente de las asignaciones.

---

### User Story 3 — Vista Rápida de Permisos por Bloque en Lista de Usuarios (Priority: P3)

Como superadmin, necesito ver en el listado general de usuarios qué bloques tiene
asignado cada uno, para identificar rápidamente usuarios sin acceso o con configuración
incompleta, sin tener que abrir el perfil de cada uno.

**Why this priority**: Acelera la detección de usuarios con configuraciones incorrectas
o sin acceso. Es una mejora de productividad del TI, no un bloqueador.

**Independent Test**: Se verifica abriendo la lista de usuarios y confirmando que cada
fila muestra iconos o etiquetas de los bloques asignados. Si un usuario no tiene ningún
bloque, aparece un indicador visual de advertencia.

**Acceptance Scenarios**:

1. **Given** el superadmin abre la lista de usuarios,
   **When** la lista carga,
   **Then** cada fila muestra los bloques asignados al usuario con sus niveles
   (ver/editar) de forma compacta (ej. chips o iconos de colores).

2. **Given** hay usuarios sin ningún bloque asignado en la lista,
   **When** el superadmin revisa la lista,
   **Then** esos usuarios tienen un indicador visual diferenciado (ej. etiqueta
   "Sin acceso") para llamar la atención del TI.

---

### Edge Cases

- ¿Qué ocurre si un usuario está dentro de un módulo cuando el superadmin le revoca
  ese bloque? — Al revocarse, la próxima petición del usuario al backend recibe 403
  y el frontend redirige al dashboard mostrando el mensaje "Sin acceso".
- ¿Qué ocurre si el sistema de permisos de bloque falla o la tabla `user_block_permissions`
  está corrupta? — El superadmin siempre puede acceder; los demás usuarios ven error
  y pueden contactar al TI.
- ¿Puede un usuario tener "editar" en un bloque pero scopes individuales más restrictivos? —
  Sí; el nivel de bloque controla la visibilidad UI, los scopes de endpoint controlan
  la autorización granular. Ambas capas coexisten (ver Constitución Art. 4.3).
- ¿Qué pasa si se crea un usuario nuevo? — Por defecto, ningún bloque está asignado.
  El TI debe asignar bloques explícitamente.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema MUST ocultar (no renderizar) en el sidebar izquierdo y en el
  dashboard cualquier bloque que el usuario no tenga asignado.
- **FR-002**: El sistema MUST ocultar (no renderizar) botones y acciones de
  escritura (crear, editar, eliminar) dentro de un bloque cuando el usuario tiene
  nivel "ver" en ese bloque.
- **FR-003**: El superadmin MUST poder acceder a una pantalla de gestión de bloques
  por usuario, accesible desde el perfil de cada usuario en el panel de administración.
- **FR-004**: El superadmin MUST poder asignar cualquiera de los 4 bloques a un usuario
  con nivel "ver" o "editar".
- **FR-005**: El superadmin MUST poder revocar cualquier bloque previamente asignado a
  un usuario.
- **FR-005a**: Los cambios de bloque en el panel de gestión MUST aplicarse solo cuando
  el superadmin presiona el botón "Guardar"; los toggles intermedios no llaman a la API.
  Una sola llamada PUT al guardar reemplaza el estado completo de bloques del usuario.
- **FR-006**: Los cambios en asignaciones de bloques MUST reflejarse en la interfaz del
  usuario afectado en su próxima carga de página, sin necesitar cerrar sesión.
- **FR-007**: El sistema MUST rechazar (403) peticiones de escritura (`POST`/`PUT`/`PATCH`/`DELETE`)
  a módulos de un bloque cuando el usuario solo tiene nivel "ver". La verificación
  se implementa con una dependencia FastAPI `require_block_write(block_slug)` declarada
  en los routers afectados, que consulta `user_block_permissions` en DB (no el JWT),
  para que la revocación sea efectiva de inmediato sin esperar a que expire el token.
- **FR-008**: El superadmin MUST tener acceso total a todos los bloques en todo momento,
  sin importar la configuración de asignaciones.
- **FR-009**: Un usuario sin bloques asignados MUST ver un dashboard con mensaje
  explicativo en lugar de un dashboard vacío sin contexto.
- **FR-010**: El sistema MUST registrar en auditoría cada cambio de asignación de bloque
  (quién lo hizo, qué usuario fue afectado, qué bloque y nivel cambió, cuándo).
- **FR-011**: El listado de usuarios MUST mostrar de forma compacta los bloques asignados
  a cada usuario para facilitar la revisión rápida del TI.

### Key Entities

- **Bloque de Acceso**: Unidad de permiso de alto nivel. Atributos: nombre visible,
  slug identificador (`operaciones`, `administracion`, `logistica`, `gerencia`), lista
  de módulos/prefijos de ruta que agrupa, ícono representativo. Los 4 bloques son fijos.
- **Asignación de Bloque**: Relación entre un usuario y un bloque con un nivel de acceso.
  Atributos: usuario, bloque, nivel (`ver` / `editar`). Un usuario puede tener 0 a 4
  asignaciones (una por bloque como máximo).
- **Dependencia de Escritura de Bloque**: Función `require_block_write(block_slug)` que
  actúa como guard de FastAPI; consulta `user_block_permissions` y lanza 403 si el
  usuario tiene nivel "ver" o no tiene el bloque asignado. Análoga a `require_permission()`.
- **Nivel de Acceso**: Enumeración de dos valores — `ver` (lectura, sin escritura),
  `editar` (lectura + escritura + eliminación).

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cero casos de "botón visible → clic → acceso denegado" para cualquier
  usuario del sistema después de implementar esta feature.
- **SC-002**: El superadmin puede asignar o revocar un bloque a un usuario en menos de
  30 segundos desde que abre el perfil del usuario.
- **SC-003**: Los cambios de asignación surten efecto en la interfaz del usuario afectado
  en menos de 1 recarga de página (sin necesidad de cerrar y volver a iniciar sesión).
- **SC-004**: El 100% de los usuarios del sistema tiene visible en su dashboard
  únicamente los bloques que les fueron explícitamente asignados.
- **SC-005**: El superadmin puede auditar quién cambió los permisos de cualquier usuario
  consultando el historial de auditoría, con fecha y responsable del cambio.

---

## Assumptions

- Los 4 bloques de acceso (Operaciones, Administración, Logística, Gerencia) son fijos
  y no configurables en esta versión. La composición de cada bloque (qué módulos incluye)
  está definida en la Constitución Art. 4.2.
- Las credenciales del superadmin se gestionan a nivel de entorno (`.env`) y el superadmin
  no está sujeto al sistema de asignación de bloques.
- El sistema de autenticación existente (JWT) se extiende para incluir los bloques
  asignados al usuario, de modo que el frontend pueda tomar decisiones de renderizado
  sin una llamada adicional al backend en cada página.
- La asignación de bloques es por usuario individual, no por rol. Si en el futuro se
  desea asignación por rol, será una feature separada.
- Los scopes de permiso granulares existentes (`require_permission`) no se eliminan;
  coexisten con la capa de bloques (ver Constitución Art. 4.3).
- El nivel "editar" otorga acceso completo de escritura dentro del bloque; no hay
  niveles intermedios (ej. "solo crear" o "solo aprobar") en esta versión.
- La UI de gestión de bloques es exclusiva del superadmin en esta versión. Un admin
  de empresa podrá delegar acceso en una feature futura.
- No se requiere soporte móvil en esta versión; la UI de gestión es desktop-first.

---

## Clarifications

### Session 2026-06-30

- Q: ¿Cómo verifica el backend si un usuario con nivel "ver" intenta hacer una escritura — JWT.blocks o tabla DB? → A: Consulta `user_block_permissions` en DB en cada request de escritura (Opción B). Revocación efectiva inmediatamente, sin ventana de JWT obsoleto.
- Q: ¿Cómo se guardan los cambios de bloque en el panel del superadmin — auto-save por toggle o botón explícito? → A: Botón "Guardar" explícito (Opción A). El TI configura todos los bloques del usuario y confirma con una sola acción; una llamada PUT al backend.
- Q: ¿Cómo sabe el backend qué bloque cubre cada endpoint para aplicar FR-007 — dependencia, middleware o verificación en service? → A: Nueva dependencia FastAPI `require_block_write(block_slug)` (Opción A), análoga a `require_permission()`, declarada en cada router afectado; consulta `user_block_permissions` en DB.
