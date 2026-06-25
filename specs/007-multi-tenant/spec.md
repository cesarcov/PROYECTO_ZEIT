# Feature Specification: Arquitectura Multi-Tenant (DB por Cliente)

**Feature Branch**: `007-multi-tenant`

**Created**: 2026-06-24

**Status**: Draft

**Input**: Migración de arquitectura single-tenant a una base de datos por empresa cliente, manteniendo compatibilidad local de desarrollo.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Superadmin registra y activa un nuevo cliente (Priority: P1)

El superadmin puede crear un nuevo tenant (empresa cliente) desde el panel de administración. Al crearlo, el sistema le asigna una base de datos propia, ejecuta todas las migraciones necesarias y crea un usuario administrador inicial para esa empresa. Desde ese momento, la empresa puede usar el ERP de forma completamente independiente.

**Why this priority**: Sin esta capacidad, el sistema no puede tener múltiples clientes. Es el flujo de ventas: "tengo un nuevo cliente" → "lo activo en el sistema en minutos".

**Independent Test**: Crear un tenant "Empresa Acme" desde el panel superadmin → el sistema confirma creación → iniciar sesión con las credenciales del admin inicial de Acme usando el identificador de Acme → ver el dashboard del ERP con datos vacíos de Acme → confirmar que los datos de Acme no se mezclan con los de otra empresa.

**Acceptance Scenarios**:

1. **Given** el superadmin está en el panel de tenants, **When** crea "Empresa Acme" con slug `acme` y email de admin `admin@acme.com`, **Then** el sistema crea una base de datos aislada para Acme, ejecuta las migraciones, crea el usuario administrador, y devuelve confirmación en menos de 30 segundos.

2. **Given** un tenant "acme" ya existe, **When** el superadmin intenta crear otro con el mismo slug, **Then** el sistema rechaza la operación con mensaje de conflicto.

3. **Given** un tenant fue creado, **When** el administrador de Acme inicia sesión, **Then** ve el ERP con datos exclusivamente de Acme (0 materiales, 0 solicitudes, sin datos de otros clientes).

4. **Given** el superadmin desactiva el tenant "acme", **When** un usuario de Acme intenta hacer login, **Then** recibe un error que le indica que su empresa no está activa.

---

### User Story 2 — Usuario de empresa accede al ERP de su empresa (Priority: P2)

Un usuario de una empresa cliente (por ejemplo, técnico de Acme) usa el ERP normalmente sin saber que existe arquitectura multi-tenant. Identifica su empresa con un slug o subdominio y todas sus acciones afectan únicamente a los datos de su empresa. Si accede desde la misma URL que otra empresa, los datos están completamente separados.

**Why this priority**: Es el flujo diario de todos los usuarios finales. Si la identificación de empresa falla, los datos se filtran o el usuario queda bloqueado sin acceso.

**Independent Test**: Con dos tenants creados (Acme y Beta), iniciar sesión en Acme y crear un material "Cable X". Luego iniciar sesión en Beta y verificar que "Cable X" no aparece. Los datos de cada empresa son invisibles para la otra.

**Acceptance Scenarios**:

1. **Given** el usuario pertenece al tenant "acme", **When** hace login con el identificador de Acme, **Then** todas sus solicitudes apuntan a la base de datos de Acme exclusivamente.

2. **Given** dos tenants activos (Acme y Beta), **When** un usuario de Acme crea un material, **Then** ese material no es visible para ningún usuario de Beta ni para el superadmin al consultar datos de Beta.

3. **Given** el usuario no incluye identificador de empresa, **When** el sistema está en modo desarrollo local, **Then** el sistema usa la base de datos de desarrollo por defecto sin error.

4. **Given** el usuario incluye un identificador de empresa que no existe, **When** hace cualquier request, **Then** recibe un error claro indicando que la empresa no fue encontrada (no accede a datos de otra empresa por error).

---

### User Story 3 — Superadmin consulta el estado de todos los tenants (Priority: P3)

El superadmin tiene una vista centralizada que le muestra todos los tenants registrados: cuáles están activos, cuándo se crearon, y puede activar/desactivar empresas sin perder sus datos.

**Why this priority**: El superadmin necesita gestionar el ciclo de vida de los clientes: cobros, suspensiones, reactivaciones. Sin esta vista, operar el negocio es inmanejable.

**Independent Test**: Con 3 tenants creados, el superadmin ve los 3 en el panel con su estado (activo/inactivo), puede desactivar uno y al intentar acceder con ese tenant se recibe un error, y al reactivarlo el acceso se restaura inmediatamente.

**Acceptance Scenarios**:

1. **Given** existen 3 tenants registrados, **When** el superadmin accede al panel de tenants, **Then** ve los 3 con nombre, slug, estado y fecha de creación.

2. **Given** un tenant está activo, **When** el superadmin lo desactiva, **Then** sus usuarios reciben error de empresa inactiva en el próximo request (sin necesidad de reiniciar el sistema).

3. **Given** un tenant está inactivo, **When** el superadmin lo reactiva, **Then** sus usuarios pueden volver a acceder inmediatamente.

---

### Edge Cases

- ¿Qué pasa si la creación de la base de datos falla a mitad del proceso de provisionamiento? El tenant debe quedar en estado "error" y el superadmin debe poder reintentar o eliminar el intento fallido sin dejar bases de datos huérfanas.
- ¿Qué pasa si hay un corte de red durante el provisionamiento? El sistema detecta el estado incompleto y permite reintento.
- ¿Qué pasa si un tenant tiene más de 10,000 registros y se desactiva? Sus datos se conservan intactos; la desactivación solo bloquea el acceso.
- ¿Qué pasa si dos requests llegan al mismo tiempo al sistema con el mismo slug de tenant? Ambas deben resolverse correctamente usando la misma conexión a la DB del tenant (no se crean conexiones duplicadas ilimitadas).
- ¿Qué pasa en modo desarrollo local sin identificador de tenant? El sistema cae a la base de datos de desarrollo sin error.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE identificar la empresa del usuario en cada request mediante un identificador único (slug de empresa), transmitido por cabecera HTTP o subdominio.

- **FR-002**: El sistema DEBE enrutar automáticamente todas las operaciones de base de datos a la base de datos exclusiva del tenant identificado, sin que el usuario ni el código de los módulos de negocio necesiten saberlo.

- **FR-003**: El superadmin DEBE poder registrar un nuevo tenant desde el panel de administración, proporcionando: nombre de empresa, slug (identificador único, sin espacios ni caracteres especiales), y email del administrador inicial.

- **FR-004**: Al crear un tenant, el sistema DEBE provisionar automáticamente: una base de datos aislada, todas las migraciones del sistema, y un usuario administrador con contraseña temporal.

- **FR-005**: El superadmin DEBE poder activar y desactivar tenants. Un tenant inactivo bloquea el acceso de sus usuarios sin eliminar sus datos.

- **FR-006**: El superadmin DEBE poder listar todos los tenants con nombre, slug, estado (activo/inactivo) y fecha de creación.

- **FR-007**: El sistema DEBE operar en modo single-tenant (fallback a la base de datos local) cuando no se proporciona identificador de empresa, para mantener compatibilidad con el entorno de desarrollo.

- **FR-008**: Si el slug de empresa no existe en el registro de tenants, el sistema DEBE rechazar la request con un error explícito (no debe asumir un tenant por defecto ni acceder a datos de otro).

- **FR-009**: Si el tenant está inactivo, el sistema DEBE rechazar todos los requests de sus usuarios con un mensaje de empresa suspendida.

- **FR-010**: Los datos de cada empresa DEBEN estar completamente aislados; ninguna consulta de un tenant puede devolver ni modificar datos de otro tenant.

### Key Entities

- **Tenant**: Empresa cliente registrada en el sistema. Tiene nombre, slug único, estado (activo/inactivo), URL de conexión a su base de datos, y fecha de creación.

- **Superadmin**: Usuario especial del sistema (no pertenece a ningún tenant) que gestiona el ciclo de vida de los tenants. Sus credenciales están en la master DB, no en la DB de ningún tenant.

- **Master DB**: Base de datos central que solo contiene el registro de tenants. No contiene datos de negocio (materiales, solicitudes, usuarios de empresa, etc.).

- **Tenant DB**: Base de datos exclusiva de una empresa. Contiene todos los datos de negocio de esa empresa. Tiene el mismo esquema que la DB actual del ERP.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un nuevo cliente puede estar operativo (con su propia base de datos, migraciones y usuario admin) en menos de 30 segundos desde que el superadmin confirma la creación.

- **SC-002**: Con 10 empresas activas simultáneamente, el tiempo de respuesta de cualquier endpoint del ERP no aumenta más de 50ms respecto a la operación single-tenant actual.

- **SC-003**: El aislamiento de datos es total: en ningún escenario de prueba es posible que un usuario de la empresa A acceda o modifique datos de la empresa B, incluso ante errores deliberados en el identificador.

- **SC-004**: El modo de desarrollo local (sin identificador de empresa) sigue funcionando sin ningún cambio en el flujo de trabajo del desarrollador — los tests existentes (17 smoke tests) pasan sin modificación.

- **SC-005**: El superadmin puede gestionar el estado de un tenant (activar/desactivar) y el cambio es efectivo en la próxima request del usuario, sin reiniciar el sistema.

---

## Assumptions

- El identificador de empresa (`X-Tenant-ID` o subdominio) es responsabilidad del cliente o del frontend configurar correctamente; el backend lo lee pero no lo descubre automáticamente.
- Las bases de datos de cada tenant se crean en el mismo servidor PostgreSQL donde está la master DB (mismas credenciales de superusuario); una arquitectura con servidores PostgreSQL separados por cliente queda fuera del alcance de esta versión.
- Las migraciones son idempotentes (usan `IF NOT EXISTS`, `IF EXISTS`); ejecutarlas sobre una DB vacía nueva siempre tiene éxito.
- El slug del tenant es inmutable una vez creado (cambiarlo requeriría cambiar la referencia en la DB de configuración y está fuera de alcance).
- El superadmin es un usuario especial definido en variables de entorno, no un rol RBAC normal del ERP.
- El frontend no requiere cambios para la identificación por cabecera `X-Tenant-ID`; el frontend ya puede incluir headers personalizados.
- La contraseña temporal del admin inicial se devuelve en la respuesta de creación del tenant y el superadmin es responsable de comunicarla al cliente.
- La eliminación permanente de tenants y sus bases de datos queda fuera de alcance de esta versión (solo se permite desactivar).
