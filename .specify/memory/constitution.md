<!--
SYNC IMPACT REPORT
==================
Versión: 1.4.0 → 1.5.0 (MINOR)
Fecha: 2026-06-30
Razón del bump: Art. 4 reestructurado completamente — se formalizan:
  (a) jerarquía de 3 niveles (superadmin / admin / usuario),
  (b) concepto de "bloques" de acceso (agrupación UI de módulos),
  (c) niveles granulares view vs edit por bloque,
  (d) principio anti-"ghost buttons" (consistencia UI-permiso, NO NEGOCIABLE).
  El rol superadmin ya existía en feature 007; esta enmienda lo eleva a
  principio de gobernanza con control total del ERP.

Principios modificados:
  Art. 4 "Control de Permisos" → restructurado en 4 subsecciones (4.1–4.4).
  Sin cambios de nombre; el artículo es más explícito y normativo.

Secciones añadidas: Art. 4.1 (Jerarquía), 4.2 (Bloques), 4.3 (Scopes), 4.4 (Consistencia UI-Permiso).
Secciones removidas: ninguna (Art. 4 anterior absorbido y expandido).

Plantillas / artefactos:
- .specify/templates/plan-template.md   -> ✅ sin cambios (Constitution Check dinámico)
- .specify/templates/spec-template.md   -> ✅ sin cambios
- .specify/templates/tasks-template.md  -> ✅ sin cambios

Follow-ups / TODOs:
- ⚠ PENDIENTE: feature 008-permission-blocks aún no existe en specs/.
  El TI (superadmin) requiere UI de gestión de bloques → iniciar con /speckit-specify.
- ⚠ PENDIENTE: la tabla `user_block_permissions` (ver Art. 4.2) debe crearse
  como migración nueva (039_user_block_permissions.sql o similar).
- ⚠ PENDIENTE: endpoints de gestión de bloques deben añadirse al inventario
  Art. 8.3 cuando se complete la feature.
- ℹ INFO: el inventario Art. 8 sigue siendo válido (276 endpoints); ningún
  endpoint fue añadido o eliminado en esta enmienda.
-->

# Constitución del Proyecto: ZEIT SOLUTIONS ERP

> Producto: **ZEIT SOLUTIONS ERP** · _Powered by CeShark_

Este documento rige todas las decisiones de diseño, convenciones de código y tecnologías
para este repositorio. Cualquier desarrollador o asistente de IA debe respetar
estrictamente estas reglas.

---

## 1. Principios de Arquitectura y Backend (FastAPI)
*   **Estructura de Módulos:** El backend se divide en módulos dentro de `app/modules/`
    (ej. `admin`, `logistics`, `operations`, `requests`, `reporting`). Cada módulo debe
    agrupar su funcionalidad en archivos separados:
    *   `router.py` - Definición de endpoints, validación de schemas de entrada/salida
        y comprobación de permisos.
    *   `service.py` - Toda la lógica de negocio, validaciones complejas y llamadas
        a base de datos.
    *   `schemas.py` - Modelos de datos Pydantic para peticiones y respuestas.
*   **Conexiones a Base de Datos:** Queda estrictamente prohibido ejecutar consultas
    SQL en los routers. Toda consulta debe ejecutarse dentro de los archivos de
    servicio (`service.py`) usando el administrador de contexto `db_connection()`.
*   **Auditoría Automática:** Las operaciones de escritura (`POST`, `PUT`, `PATCH`,
    `DELETE`) se auditan automáticamente mediante `AuditMiddleware`. No añadas registros
    manuales de auditoría en los controladores a menos que sea necesario un detalle extra.

---

## 2. Convenciones del Frontend (React + Vite)
*   **Identidad de Marca:** El producto se presenta al usuario como **ZEIT SOLUTIONS
    ERP**. El crédito del desarrollador aparece SIEMPRE en segundo plano como
    **"Powered by CeShark"** (p. ej. en la pantalla de login y el footer), nunca como
    marca principal. Toda superficie visible al usuario MUST mostrar "ZEIT SOLUTIONS";
    las cadenas y logos heredados "CeShark" se migran progresivamente a esta convención.
*   **Sistema de Temas (Theming) — NO NEGOCIABLE para UI nueva:**
    *   La interfaz MUST soportar temas configurables por el usuario, como mínimo
        **claro** y **oscuro**.
    *   Los colores se consumen mediante **tokens / variables de tema** (variables CSS
        o un theme provider), **NUNCA** como valores hex literales dispersos por los
        componentes.
    *   La preferencia de tema se **persiste por usuario** y se aplica de inmediato,
        sin recargar la página.
    *   Introducir un componente con colores hardcodeados (fuera de los tokens) se
        considera incumplimiento de esta constitución.
*   **Paleta de Marca ZEIT SOLUTIONS (oficial):** Los tokens base derivan de la paleta
    corporativa:
    *   Azul Corporativo (primario): `#003A8C`
    *   Azul Oscuro (superficies profundas / base del tema oscuro): `#001F54`
    *   Turquesa Tecnológico (acento): `#00D4D8`
    *   Naranja Energía (acción / resaltado activo / CTAs): `#FF6B00`
    *   Gris Industrial (texto secundario / bordes): `#5A6573`
    *   Cada tema (claro/oscuro) mapea estos colores corporativos a sus tokens;
        el tema oscuro usa el Azul Oscuro como base.
    *   **White-label:** esta paleta es el **tema de marca por defecto**. Cuando una
        empresa configura su propia marca, el administrador define sus colores
        corporativos (primario/acento/acción), que **reemplazan** estos valores; las
        reglas específicas de ZEIT aplican al default ZEIT y **no obligan** a otras
        empresas. El sistema MUST preservar legibilidad/contraste en cualquier paleta.
*   **Estilos y Tailwind:**
    *   Se utiliza Tailwind CSS v4 para utilidades generales en componentes atómicos.
    *   En las vistas principales (`pages/`), se permiten **estilos inline usando
        objetos de Javascript** para componentes contenedores principales; sin embargo,
        **los colores deben provenir de los tokens del tema activo**, no de literales
        hex, para asegurar flexibilidad de diseño y compatibilidad con el cambio de tema.
*   **Autenticación y API:**
    *   La URL base de la API MUST importarse desde las variables de entorno:
        `import.meta.env.VITE_API_URL ?? "http://127.0.0.1:8000"`. Esta regla aplica a
        **todos los archivos compilados por Vite** que realizan llamadas HTTP:
        componentes React, hooks, servicios y archivos JS planos (como `brand.js`).
        **Prohibido** definir una constante literal `API_BASE` o `BASE` con una URL
        hardcodeada.
    *   Toda petición HTTP autenticada debe incluir el encabezado
        `Authorization: Bearer <token>` extraído de `localStorage.getItem("access_token")`.

---

## 3. Base de Datos y Migraciones (PostgreSQL)
*   **Control de Migraciones:** No realices cambios directos sobre la base de datos de
    producción. Todo cambio en el esquema debe registrarse como un script SQL
    incremental en la carpeta `migrations/` (ej. `030_nuevo_campo.sql`) y aplicarse
    ejecutando `run_migrations.py`.
*   **Integridad y Duplicados:** Al crear tablas de enlace, llaves foráneas o datos de
    catálogo, utiliza restricciones de unicidad o verificaciones `NOT EXISTS` en tus
    scripts de migración e inserción para evitar duplicaciones accidentales.

---

## 4. Control de Permisos

### 4.1 Jerarquía de Roles (3 niveles)

El sistema tiene tres niveles de autorización, en orden descendente de privilegio:

1.  **Superadmin (TI):** Control total e irrestricto del ERP. Puede crear/suspender
    cualquier usuario, asignar o revocar cualquier bloque/permiso, y resolver
    atascamientos de acceso sin importar el tenant o módulo. Sus credenciales se
    gestionan en `.env` (`SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`); el JWT
    resultante lleva `role=superadmin`. El superadmin MUST poder acceder a todos los
    módulos del sistema en todo momento, incluso si las tablas de permisos estuvieran
    vacías o corruptas.

2.  **Admin de empresa / módulo:** Gestión de usuarios dentro de su scope. Puede
    asignar bloques a usuarios bajo su cargo, limitado a los bloques que él mismo
    tiene asignados. No puede elevarse a superadmin ni asignar bloques que no posee.

3.  **Usuario:** Accede exclusivamente a los bloques y nivel de permiso (ver/editar)
    que le asignó un admin o el superadmin.

### 4.2 Bloques de Acceso (agrupación UI de módulos)

Los módulos del ERP se agrupan en **bloques** de acceso. Un bloque es la unidad
mínima que el superadmin o admin puede conceder a un usuario:

| Bloque | Módulos / prefijos de ruta incluidos |
|--------|--------------------------------------|
| **Operaciones** | `/operations`, `/canal`, `/requerimientos`, `/planificacion` |
| **Administración** | `/admin`, `/reporting`, `/ot`, `/compras` |
| **Logística** | `/logistics`, `/requests` |
| **Gerencia** | `/gerencia`, `/cotizaciones`, `/clientes` |

Cada bloque puede asignarse con uno de dos niveles de acceso:

| Nivel | Qué permite |
|-------|-------------|
| `view` | Solo lectura: el usuario puede navegar y consultar datos del bloque |
| `edit` | Lectura + escritura: el usuario puede crear, editar y eliminar dentro del bloque |

La ausencia de asignación equivale a **denegación total**: el bloque no se muestra
y sus endpoints devuelven 403.

**Modelo de datos:** la relación usuario ↔ bloque se persiste en la tabla
`user_block_permissions (user_id, block_slug, level)` con restricción UNIQUE
`(user_id, block_slug)`.

### 4.3 Scopes de Permisos (granularidad de endpoint)

Dentro de cada bloque, los endpoints individuales siguen protegidos con
`require_permission("scope:name")`. Los scopes soportados son:

*   `admin` — Gestión de usuarios, roles generales e inspección de auditoría.
*   `logistics` — Inventario, almacenes, despachos y compras.
*   `operations` — Planes de proyecto y envío de requerimientos.

La asignación de bloque NO reemplaza los scopes; ambas capas coexisten. El bloque
controla la **visibilidad UI y el acceso de alto nivel**; los scopes controlan la
**autorización por endpoint**. Cuando el superadmin asigna un bloque, el sistema
debe conceder automáticamente los scopes correspondientes al usuario.

**Verificación:** Utiliza siempre `require_permission("scope:name")` en la firma de
endpoints para validar la autorización del usuario actual.

**Lecturas públicas justificadas:** se permiten endpoints de **solo lectura** sin
`require_permission` cuando sean necesarios **antes de autenticar** (p. ej. la
identidad de marca) y **no expongan datos sensibles**; deben documentarse
explícitamente en el plan de la feature.

### 4.4 Consistencia UI-Permiso — Principio Anti-Ghost-Button (NO NEGOCIABLE)

Un botón, tarjeta, enlace o ítem de menú que apunta a un recurso para el cual el
usuario **no tiene asignado el bloque correspondiente** MUST NOT renderizarse en
pantalla.

**No se permite el patrón "elemento visible → clic → acceso denegado".**

El frontend MUST consultar los permisos del usuario (obtenidos del JWT o del endpoint
`/auth/me`) antes de renderizar cualquier elemento de navegación a un bloque. Si el
usuario no tiene el bloque, el elemento no existe en el DOM — no está oculto con CSS,
no está deshabilitado: simplemente no se renderiza.

Las únicas excepciones son elementos de UI que muestran el estado de acceso
explícitamente (ej. "Solicitar acceso a Gerencia"), que sí pueden mostrarse a usuarios
sin permiso.

---

## 5. Calidad, Pruebas y Compuerta de Verificación (NO NEGOCIABLE)
*   **Nada se considera "terminado" sin la compuerta en verde.** La compuerta es:
    (1) el backend importa (`python -c "import app.main"`), (2) la suite de smoke tests
    pasa (`pytest tests/smoke`), y (3) el frontend compila (`npm run build`). Script
    único: `verify.ps1` en la raíz del repo.
*   **Bugfix reproduce-primero:** todo bug se corrige escribiendo ANTES un test que lo
    reproduce (rojo), luego el arreglo, y el test pasa (verde). Después se corre la
    suite completa para confirmar que no se rompió nada más.
*   **Cobertura mínima creciente:** cada endpoint nuevo agrega al menos un smoke test
    (código 200 + forma del JSON) probado con el rol real correspondiente.
*   **Tests no destructivos:** los smoke tests que mutean estado compartido (PUT/DELETE
    sobre config real) DEBEN guardar el estado previo y restaurarlo al terminar
    (patrón save → test → restore). Los archivos binarios (logos, uploads) no pueden
    restaurarse automáticamente; si el test los elimina, debe condicionarse para solo
    ejecutar el DELETE cuando no haya datos reales configurados.

---

## 6. Verdad del Esquema y Defensa de Datos (lecciones aprendidas 2026-06-11)
*   **Esquema real, no de memoria:** antes de escribir SQL, verifica nombres de
    tabla/columna contra `information_schema` o el módulo canónico que ya las usa.
    (Lección: `dispatches`→`stock_dispatches`, `oci.cantidad`→`oci.cantidad_pedida`.)
*   **Nulos defensivos:** toda agregación SQL que pueda devolver `NULL` se castea con
    guarda (`COALESCE` en SQL o un helper como `_f()` en Python). Nunca `float(None)`.
    (Lección: 3 errores 500 encadenados en Reportes/KPIs.)
*   **Errores visibles, nunca silenciosos:** prohibido `except: pass`. El frontend
    muestra estado de error/reintento, jamás una pantalla en blanco por `data` nulo.

---

## 7. Flujo Spec-Driven (SDD) y convenciones operativas
*   **La especificación es la fuente de verdad.** Toda feature nueva o cambio
    significativo sigue: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan`
    → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. (Skills en
    `.claude/skills/`; requieren abrir Claude Code con `erp-modular/` como raíz.)
*   **Una feature = una rama git.** Cada `specs/NNN-*` vive en su rama y se mergea
    solo con la compuerta en verde.
*   **Orden de rutas:** los endpoints literales (`/export`, `/import`, `/bulk`) se
    declaran SIEMPRE antes de las rutas con parámetro (`/{id}`) para evitar capturas
    erróneas del path.
*   **Scripts/health-checks locales:** usar `127.0.0.1`, no `localhost` (uvicorn
    bindea IPv4; `localhost` puede resolver a IPv6 `::1` y fallar). Esta regla cubre
    **todos los callsites**: scripts Python, hooks, fetch en archivos JS planos y
    componentes React. Violaciones conocidas pendientes: `brand.js`, `AdminBranding.jsx`,
    `Layout.jsx:297`.

---

## 8. Inventario Canónico de API (resultado auditoría 2026-06-24)

### 8.1 Infraestructura base

*   **Puerto único**: `8000` (uvicorn). El sistema **NO** tiene multi-port.
*   **Auth único**: JWT HS256. Un solo sistema, gestionado enteramente en `/auth`.
    Variables de entorno requeridas: `DATABASE_URL`, `SECRET_KEY`,
    `ACCESS_TOKEN_EXPIRE_MINUTES`, `ALGORITHM`.
*   **Docs en producción**: los endpoints `/docs`, `/redoc` y `/openapi.json` están
    deshabilitados cuando `ENV=production` (condicional en `app/main.py`). En desarrollo
    (default) siguen accesibles normalmente.
*   **Auth a nivel de router**: algunos módulos aplican la dependencia de auth en el
    constructor del router (`dependencies=[Depends(get_current_user)]`) en lugar de en
    cada función. Esto es equivalente y válido; las auditorías deben inspectar ambos
    niveles. Módulos que usan este patrón: `reporting`.

### 8.2 Endpoints públicos aprobados (sin autenticación)

| Método | Ruta | Justificación |
|--------|------|---------------|
| GET | `/` | Health check mínimo |
| GET | `/branding` | Marca visible antes de login (Art. 4.3) |
| POST | `/auth/login` | Punto de entrada de auth |
| POST | `/auth/refresh` | Renovación de token (usa refresh_token en body) |
| POST | `/auth/logout` | Invalidación client-side (token expira por TTL) |

Cualquier otro endpoint sin `require_permission` o `get_current_user` es una
**violación que debe corregirse inmediatamente**.

### 8.3 Módulos de negocio (prefijos de ruta canónicos)

| Módulo | Prefijo | Endpoints | Descripción |
|--------|---------|-----------|-------------|
| Auth | `/auth` | 6 | Login, logout, refresh, perfil, preferencias |
| Admin | `/admin` | 17 | Usuarios, roles, permisos, auditoría |
| Logística | `/logistics` | 87 | Stock, materiales, almacenes, despachos, herramientas, lotes, transferencias, inv. físico |
| Solicitudes | `/requests` | 13 | Pedidos de materiales, reservas, despachos |
| Reportes | `/reporting` | 8 | KPIs, dashboards, exports |
| Operaciones | `/operations` | 21 | Planes, grupos de materiales, envíos |
| Canal | `/canal` | 7 | Comunicación inter-módulo |
| Cotizaciones | `/cotizaciones` | 38 | APU, partidas, baúles, tarifas, clientes, export |
| Órdenes de Trabajo | `/ot` | 17 | OTs, materiales, checklist, tiempo, generación de OC |
| Compras | `/compras` | 18 | Proveedores, órdenes de compra, recepción |
| Clientes | `/clientes` | 7 | CRUD clientes, contactos, cotizaciones |
| Planificación | `/planificacion` | 23 | Actividades, subtareas, productividad, KPIs, export |
| Gerencia | `/gerencia` | 2 | Aprobaciones gerenciales |
| Requerimientos | `/requerimientos` | 7 | CRUD requerimientos, costos, KPIs |
| Branding | `/branding` | 4 | Marca configurable white-label |
| Superadmin | `/superadmin` | — | Gestión de tenants y permisos de bloque (feature 007/008) |
| **TOTAL** | | **276+** | (superadmin endpoints se añaden al completar feature 008) |

### 8.4 Deuda técnica registrada

*   ~~**`/logistics/dispatches/{id}/dispatch-legacy`**~~ — **ELIMINADO** (commit
    `30b7917`, 2026-06-24). No tenía llamadores en frontend ni backend.
*   **Módulo `logistics` (87 endpoints)** — candidato a subdivisión futura en módulos
    más pequeños (ej. `stock`, `warehouses`, `tools`, `dispatches`) cuando el
    mantenimiento lo justifique. No bloquea el trabajo actual.

---

## 9. Inventario Canónico de Base de Datos (auditoría 2026-06-24)

### 9.1 Resumen

*   **Base de datos única**: PostgreSQL — esquema `public`.
*   **67 objetos totales**: 59 tablas base + 8 vistas (`vw_*`).
*   **Tabla más activa**: `audit_logs` (9.631 filas — crece con cada operación).
*   **Tabla más compleja**: `materials` (41 columnas — núcleo del módulo logistics).
*   **Tabla más grande en sesiones**: `refresh_tokens` (276 filas — una por sesión activa).
*   **Pendiente (feature 008)**: tabla `user_block_permissions` (Art. 4.2) aún no
    existe — se crea con la migración correspondiente.

### 9.2 Tablas por dominio de negocio

#### Seguridad y Auth (6 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `users` | 8 | 13 | Cuentas de usuario (email, password hash, username) |
| `roles` | 2 | 12 | Catálogo de roles del sistema |
| `permissions` | 2 | 53 | Catálogo de scopes de permisos |
| `role_permissions` | 2 | 173 | Relación N:M rol ↔ permiso |
| `user_roles` | 2 | 14 | Relación N:M usuario ↔ rol |
| `refresh_tokens` | 8 | 276 | Tokens JWT de renovación (con hash, revocación, TTL) |

#### Auditoría (1 tabla)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `audit_logs` | 18 | 9.631 | Registro automático de todas las operaciones (AuditMiddleware) |

#### Materiales e Inventario (5 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `materials` | 41 | 106 | Catálogo central de materiales/equipos (⚠ 41 cols — tabla pivote) |
| `material_aliases` | 3 | 3 | Nombres alternativos por material |
| `material_groups` | 7 | — | Grupos reutilizables de materiales para planes |
| `material_group_items` | 6 | — | Items de cada grupo (material + cantidad + desgaste) |
| `stock_item_categories` | 7 | — | Categorías de movimiento (afecta stock, retornable, etc.) |

#### Stock y Almacenes (11 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `warehouses` | 5 | 1 | Almacenes físicos |
| `stock_locations` | 10 | 105 | Ubicación rack/level/box por material y almacén |
| `stock_movements` | 13 | 105 | Historial de movimientos de stock (entrada/salida) |
| `stock_lots` | 15 | — | Lotes de materiales (trazabilidad, vencimiento) |
| `stock_lot_movements` | 7 | — | Movimientos asociados a lotes |
| `stock_reservations` | 13 | — | Reservas de stock por proyecto/usuario |
| `stock_dispatches` | 19 | — | Despachos de materiales a obras |
| `stock_dispatch_items` | 8 | — | Items despachados |
| `warehouse_transfers` | 12 | — | Transferencias entre almacenes |
| `warehouse_transfer_items` | 8 | — | Items de cada transferencia |
| `physical_inventories` | 11 | 1 | Inventarios físicos (conteo real vs sistema) |
| `physical_inventory_items` | 11 | 105 | Items contados en cada inventario |

#### Herramientas y Equipos (5 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `tool_assignments` | 11 | — | Asignación de herramienta a proyecto |
| `tool_loans` | 8 | — | Préstamos de herramienta a usuario |
| `tool_maintenance` | 7 | — | Plan de mantenimiento por herramienta |
| `equipment_maintenance` | 5 | — | Última/próxima fecha de mantenimiento general |
| `calibration_records` | 9 | 1 | Historial de calibración (certificados, vencimiento) |

#### Solicitudes y Pedidos (5 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `material_requests` | 19 | — | Solicitudes de materiales (con estado/tipo enum) |
| `material_request_items` | 4 | — | Items de cada solicitud |
| `material_request_audit` | 8 | — | Historial de cambios de estado por solicitud |
| `purchase_items` | 14 | — | Lista de compras pendientes (materiales a adquirir) |
| `project_plan_submissions` | 9 | — | Envíos de plan de materiales a logística |
| `project_plan_submission_items` | 15 | — | Items de cada envío |

#### Proyectos y Planes (3 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `projects` | 4 | 1 | Proyectos (código + nombre) |
| `project_plans` | 10 | 5 | Planes de materiales por proyecto (en borrador/activo) |
| `project_plan_items` | 9 | 1 | Items del plan (material + cantidad + desgaste) |

#### Planificación y Productividad (4 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `planificacion_semanal` | 18 | 38 | Actividades planificadas (tarea, cliente, responsable, fechas) |
| `planificacion_subtareas` | 7 | 155 | Subtareas de cada actividad |
| `planificacion_historial` | 5 | — | Snapshots JSON de actividades (historial de cambios) |
| `registro_productividad` | 10 | 84 | Registro diario de horas/actividades por usuario |

#### Compras y Proveedores (4 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `proveedores` | 11 | 1 | Catálogo de proveedores |
| `ordenes_compra` | 17 | 1 | Órdenes de compra (con estado y recepción parcial) |
| `ordenes_compra_items` | 8 | — | Items de cada OC (cantidad pedida/recibida) |
| `material_proveedores` | 8 | — | Relación material ↔ proveedor (precio, tiempo entrega) |

#### Órdenes de Trabajo (4 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `ordenes_trabajo` | 21 | 18 | OTs (vinculadas a plan/partida, con estado y técnicos) |
| `ot_checklist` | 8 | 1 | Checklist de tareas por OT |
| `ot_materiales` | 10 | — | Materiales planificados/reales consumidos por OT |
| `ot_tiempos` | 7 | — | Registro de tiempo por técnico en cada OT |

#### Cotizaciones y Presupuesto (8 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `presupuesto_config` | 21 | 4 | Config del presupuesto por plan (GG%, utilidad%, IGV%, moneda) |
| `presupuesto_partidas` | 11 | 10 | Partidas/capítulos del presupuesto |
| `presupuesto_apu_items` | 10 | 21 | Análisis de Precio Unitario por partida |
| `apu_baules` | 7 | — | Biblioteca de APUs reutilizables |
| `apu_baul_items` | 11 | — | Items de cada baúl APU |
| `recursos_mo` | 8 | 1 | Catálogo de recursos de mano de obra (tarifa/hora) |
| `tarifas_personal` | 14 | 10 | Tarifas por rol/contexto/modalidad |
| `categorias_costo` | 8 | 8 | Categorías de costo (directo/indirecto, orden, color) |
| `visitas_tecnicas` | 10 | 1 | Visitas técnicas asociadas a planes (costo, destino, estado) |

#### Clientes (2 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `clientes` | 13 | 6 | Clientes (RUC, razón social, contacto principal) |
| `cliente_contactos` | 8 | 7 | Contactos adicionales por cliente |

#### Requerimientos de Servicio (2 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `servicio_requerimientos` | 9 | — | Requerimientos de servicio por cliente |
| `servicio_requerimiento_costos` | 10 | — | Costos detallados por requerimiento |

#### Canal Inter-módulo (2 tablas)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `canal_solicitudes` | 13 | 1 | Solicitudes inter-módulo (con código, estado, asignado) |
| `canal_mensajes` | 5 | 3 | Mensajes dentro de cada solicitud |

#### Gerencia (1 tabla)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `aprobaciones_gerencia` | 11 | 3 | Aprobaciones gerenciales (cotizaciones, OTs, requerimientos) |

#### Branding (1 tabla)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `branding` | 12 | 1 | Marca configurable (singleton id=1; NULL = usar default ZEIT) |

#### Permisos de Bloque — PENDIENTE feature 008 (0 tablas por ahora)
| Tabla | Cols | Filas | Propósito |
|-------|------|-------|-----------|
| `user_block_permissions` | *(por definir)* | — | Asignación bloque+nivel por usuario (Art. 4.2) |

### 9.3 Vistas (8 vistas — solo lectura, sin persistencia propia)

| Vista | Propósito |
|-------|-----------|
| `vw_kpi_material_requests_by_approver` | KPIs de aprobaciones por usuario |
| `vw_kpi_material_requests_lead_time` | Lead time promedio/p95 de solicitudes |
| `vw_kpi_material_requests_monthly` | Solicitudes por mes (aprobadas/rechazadas/pendientes) |
| `vw_kpi_material_requests_sla` | Cumplimiento de SLA de solicitudes |
| `vw_kpi_material_requests_summary` | Resumen global de solicitudes |
| `vw_material_requests_operational` | Vista operacional enriquecida de solicitudes |
| `vw_requests_kpi_summary` | KPI consolidado del módulo requests |
| `vw_stock_availability` | Stock disponible (descontando reservas) por material/almacén |

### 9.4 Observaciones y deuda técnica de datos

*   **`materials` (41 cols)** — tabla pivote que concentra stock, calibración, herramientas
    y equipos. A medida que el sistema crezca, considerar separar en `equipment` /
    `consumables`. No bloquea el trabajo actual.
*   **`tool_assignments` + `tool_loans`** — dos tablas con solapamiento conceptual
    (asignación vs préstamo de herramienta). Evaluar unificación en futura feature de
    mantenimiento.
*   **`equipment_maintenance` + `tool_maintenance`** — idem, dos tablas para
    mantenimiento de equipos. Candidatas a unificar.
*   **`visitas_tecnicas`** — tabla existente pero no visible en el frontend actual.
    Verificar si está integrada o es deuda técnica pendiente de UI.
*   **Todas las PK son UUID** salvo `canal_solicitudes` y `canal_mensajes` que usan
    `integer` auto-incremental — inconsistencia menor, sin impacto funcional actual.

---

## Governance
*   Esta constitución prevalece sobre cualquier otra práctica del repositorio. Las
    enmiendas se documentan aquí con fecha y se versionan (SemVer: MAJOR cambios
    incompatibles de principios; MINOR principios/secciones nuevos o ampliados;
    PATCH aclaraciones).
*   Los cambios de identidad de marca y de Design System son de nivel governance y se
    registran como enmiendas versionadas.
*   Toda revisión de código (humana o IA) debe verificar el cumplimiento de estos
    artículos. La complejidad debe justificarse; ante la duda, aplicar YAGNI.
*   La colaboración con Antigravity se mantiene según `COLLABORATION.md`: la spec es
    la fuente de verdad compartida.
*   **Auditorías periódicas**: el inventario del Art. 8 se actualiza con cada nueva
    feature que agregue o elimine endpoints. El comando `/speckit-constitution` con
    solicitud de auditoría genera el inventario actualizado automáticamente.

**Version**: 1.5.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-30
