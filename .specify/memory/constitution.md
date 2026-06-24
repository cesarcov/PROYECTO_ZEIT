<!--
SYNC IMPACT REPORT
==================
Versión: 1.3.0 → 1.3.1 (PATCH)
Fecha: 2026-06-24
Razón del bump: cierre de los 3 TODOs del Art. 8; corrección del conteo de endpoints
(276 tras eliminar dispatch-legacy); aclaración de patrón de auth a nivel de router;
confirmación de que todos los endpoints reset están debidamente protegidos.

Segunda auditoría backend (2026-06-24) — resultado LIMPIO:
────────────────────────────────────────────────────────────
✅ dispatch-legacy ELIMINADO → 276 endpoints (era 277).
✅ /docs, /redoc, /openapi.json deshabilitados en ENV=production (app/main.py).
✅ /reporting/* — falso positivo de auditoría: auth aplicada a nivel de router
   mediante dependencies=[Depends(get_current_user)]; todos protegidos.
✅ /admin/reset-all protegido con require_permission("admin:users").
✅ /logistics/admin/reset protegido con require_permission("logistics:admin:reset").
✅ Endpoints públicos sin justificación: NINGUNO.
✅ Violaciones Art.2/7 (API_BASE literal, localhost) corregidas en feature 003.
ℹ Módulo logistics (87 endpoints, 31% del total) candidato a sub-dividir a futuro.

Secciones añadidas/removidas: ninguna (solo actualizaciones en Art. 8).

Plantillas / artefactos:
- .specify/templates/plan-template.md   -> ✅ sin cambios
- .specify/templates/spec-template.md   -> ✅ sin cambios
- .specify/templates/tasks-template.md  -> ✅ sin cambios

Follow-ups / TODOs:
- ℹ INFO: patrón de auth a nivel de router (dependencies=[]) es válido y equivalente
  a require_permission en cada función. Las auditorías futuras deben inspectar también
  router.dependencies, no solo el cuerpo de la función.
- ℹ INFO: módulo logistics (87 endpoints) es candidato a sub-dividir cuando el
  mantenimiento lo justifique. No bloquea trabajo actual.
- ✅ CERRADO: dispatch-legacy eliminado (commit 30b7917).
- ✅ CERRADO: /docs y /redoc deshabilitados en producción (commit 7a6bf97).
- ✅ CERRADO: violaciones API_BASE / localhost corregidas (feature 003, commit c7b409f).
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
*   **Scopes:** Los endpoints se protegen mediante scopes de permisos específicos.
    Los roles soportados son:
    *   `admin` - Gestión de usuarios, roles generales e inspección de auditoría.
    *   `logistics` - Inventario, almacenes, despachos y compras.
    *   `operations` - Planes de proyecto y envío de requerimientos.
*   **Verificación:** Utiliza siempre la dependencia `require_permission("scope:name")`
    en la firma de tus endpoints para validar la autorización del usuario actual.
*   **Lecturas públicas justificadas:** se permiten endpoints de **solo lectura** sin
    `require_permission` cuando sean necesarios **antes de autenticar** (p. ej. la
    identidad de marca que muestra la pantalla de login) y **no expongan datos
    sensibles**; deben documentarse explícitamente en el plan de la feature. Toda
    **escritura** (`POST/PUT/PATCH/DELETE`) sigue exigiendo `require_permission`.

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
| GET | `/branding` | Marca visible antes de login (Art. 4) |
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
| **TOTAL** | | **276** | |

### 8.4 Deuda técnica registrada

*   ~~**`/logistics/dispatches/{id}/dispatch-legacy`**~~ — **ELIMINADO** (commit
    `30b7917`, 2026-06-24). No tenía llamadores en frontend ni backend.
*   **Módulo `logistics` (87 endpoints)** — candidato a subdivisión futura en módulos
    más pequeños (ej. `stock`, `warehouses`, `tools`, `dispatches`) cuando el
    mantenimiento lo justifique. No bloquea el trabajo actual.

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

**Version**: 1.3.1 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-24
