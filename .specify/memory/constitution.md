<!--
SYNC IMPACT REPORT
==================
Versión: 1.0.0 → 1.1.0 (MINOR)
Razón del bump: se AÑADEN el principio de Sistema de Temas (theming) y la
Identidad de Marca (ZEIT SOLUTIONS); se EXPANDE el Art. 2 (Design System a base
de tokens). Ningún principio fue removido; la paleta previa se conserva como
"tema de marca por defecto".

Modificados:
- Título del proyecto: "CeShark ERP Modular" -> "ZEIT SOLUTIONS ERP" (Powered by CeShark)
- Art. 2 (Frontend): "paleta fija con hex inline" -> "colores por tokens; tema claro
  de marca por defecto + tema oscuro; configurable y persistido por usuario"

Secciones añadidas:
- Art. 2 -> "Identidad de Marca"
- Art. 2 -> "Sistema de Temas (Theming)"

Secciones removidas: ninguna.

Plantillas / artefactos:
- .specify/templates/plan-template.md   -> ✅ sin cambios (Constitution Check es genérico)
- .specify/templates/spec-template.md   -> ✅ sin cambios
- .specify/templates/tasks-template.md  -> ✅ sin cambios
- CLAUDE.md (agent context)             -> ✅ sin cambios (apunta al plan activo)

Follow-ups / TODOs:
- ✅ Colores de marca ZEIT SOLUTIONS incorporados (Azul #003A8C, Azul Oscuro #001F54,
  Turquesa #00D4D8, Naranja #FF6B00, Gris #5A6573) — reemplazan al teal previo.
- ⚠ pending: migrar las cadenas/logos visibles "CeShark" del código y docs a
  "ZEIT SOLUTIONS" + crédito "Powered by CeShark". Se hará como trabajo de feature,
  no en esta enmienda.
-->

# Constitución del Proyecto: ZEIT SOLUTIONS ERP

> Producto: **ZEIT SOLUTIONS ERP** · _Powered by CeShark_

Este documento rige todas las decisiones de diseño, convenciones de código y tecnologías para este repositorio. Cualquier desarrollador o asistente de IA debe respetar estrictamente estas reglas.

---

## 1. Principios de Arquitectura y Backend (FastAPI)
*   **Estructura de Módulos:** El backend se divide en módulos dentro de `app/modules/` (ej. `admin`, `logistics`, `operations`, `requests`, `reporting`). Cada módulo debe agrupar su funcionalidad en archivos separados:
    *   `router.py` - Definición de endpoints, validación de schemas de entrada/salida y comprobación de permisos.
    *   `service.py` - Toda la lógica de negocio, validaciones complejas y llamadas a base de datos.
    *   `schemas.py` - Modelos de datos Pydantic para peticiones y respuestas.
*   **Conexiones a Base de Datos:** Queda estrictamente prohibido ejecutar consultas SQL en los routers. Toda consulta debe ejecutarse dentro de los archivos de servicio (`service.py`) usando el administrador de contexto `db_connection()`.
*   **Auditoría Automática:** Las operaciones de escritura (`POST`, `PUT`, `PATCH`, `DELETE`) se auditan automáticamente mediante `AuditMiddleware`. No añadas registros manuales de auditoría en los controladores a menos que sea necesario un detalle extra.

---

## 2. Convenciones del Frontend (React + Vite)
*   **Identidad de Marca:** El producto se presenta al usuario como **ZEIT SOLUTIONS ERP**. El crédito del desarrollador aparece SIEMPRE en segundo plano como **"Powered by CeShark"** (p. ej. en la pantalla de login y el footer), nunca como marca principal. Toda superficie visible al usuario MUST mostrar "ZEIT SOLUTIONS"; las cadenas y logos heredados "CeShark" se migran progresivamente a esta convención.
*   **Sistema de Temas (Theming) — NO NEGOCIABLE para UI nueva:**
    *   La interfaz MUST soportar temas configurables por el usuario, como mínimo **claro** y **oscuro**.
    *   Los colores se consumen mediante **tokens / variables de tema** (variables CSS o un theme provider), **NUNCA** como valores hex literales dispersos por los componentes.
    *   La preferencia de tema se **persiste por usuario** y se aplica de inmediato, sin recargar la página.
    *   Introducir un componente con colores hardcodeados (fuera de los tokens) se considera incumplimiento de esta constitución.
*   **Paleta de Marca ZEIT SOLUTIONS (oficial):** Los tokens base derivan de la paleta corporativa:
    *   Azul Corporativo (primario): `#003A8C`
    *   Azul Oscuro (superficies profundas / base del tema oscuro): `#001F54`
    *   Turquesa Tecnológico (acento): `#00D4D8`
    *   Naranja Energía (acción / resaltado activo / CTAs): `#FF6B00`
    *   Gris Industrial (texto secundario / bordes): `#5A6573`
    *   Cada tema (claro/oscuro) mapea estos colores corporativos a sus tokens; el tema oscuro usa el Azul Oscuro como base.
*   **Estilos y Tailwind:**
    *   Se utiliza Tailwind CSS v4 para utilidades generales en componentes atómicos.
    *   En las vistas principales (`pages/`), se permiten **estilos inline usando objetos de Javascript** para componentes contenedores principales; sin embargo, **los colores deben provenir de los tokens del tema activo**, no de literales hex, para asegurar flexibilidad de diseño y compatibilidad con el cambio de tema.
*   **Autenticación y API:**
    *   La URL base de la API debe importarse desde las variables de entorno: `import.meta.env.VITE_API_URL ?? "http://localhost:8000"`.
    *   Toda petición HTTP autenticada debe incluir el encabezado `Authorization: Bearer <token>` extraído de `localStorage.getItem("access_token")`.

---

## 3. Base de Datos y Migraciones (PostgreSQL)
*   **Control de Migraciones:** No realices cambios directos sobre la base de datos de producción. Todo cambio en el esquema debe registrarse como un script SQL incremental en la carpeta `migrations/` (ej. `030_nuevo_campo.sql`) y aplicarse ejecutando `run_migrations.py`.
*   **Integridad y Duplicados:** Al crear tablas de enlace, llaves foráneas o datos de catálogo, utiliza restricciones de unicidad o verificaciones `NOT EXISTS` en tus scripts de migración e inserción para evitar duplicaciones accidentales.

---

## 4. Control de Permisos
*   **Scopes:** Los endpoints se protegen mediante scopes de permisos específicos. Los roles soportados son:
    *   `admin` - Gestión de usuarios, roles generales e inspección de auditoría.
    *   `logistics` - Inventario, almacenes, despachos y compras.
    *   `operations` - Planes de proyecto y envío de requerimientos.
*   **Verificación:** Utiliza siempre la dependencia `require_permission("scope:name")` en la firma de tus endpoints para validar la autorización del usuario actual.

---

## 5. Calidad, Pruebas y Compuerta de Verificación (NO NEGOCIABLE)
*   **Nada se considera "terminado" sin la compuerta en verde.** La compuerta es: (1) el backend importa (`python -c "import app.main"`), (2) la suite de smoke tests pasa (`pytest tests/smoke`), y (3) el frontend compila (`npm run build`). Script único: `verify.ps1` en la raíz del repo.
*   **Bugfix reproduce-primero:** todo bug se corrige escribiendo ANTES un test que lo reproduce (rojo), luego el arreglo, y el test pasa (verde). Después se corre la suite completa para confirmar que no se rompió nada más.
*   **Cobertura mínima creciente:** cada endpoint nuevo agrega al menos un smoke test (código 200 + forma del JSON) probado con el rol real correspondiente.

## 6. Verdad del Esquema y Defensa de Datos (lecciones aprendidas 2026-06-11)
*   **Esquema real, no de memoria:** antes de escribir SQL, verifica nombres de tabla/columna contra `information_schema` o el módulo canónico que ya las usa. (Lección: `dispatches`→`stock_dispatches`, `oci.cantidad`→`oci.cantidad_pedida`.)
*   **Nulos defensivos:** toda agregación SQL que pueda devolver `NULL` se castea con guarda (`COALESCE` en SQL o un helper como `_f()` en Python). Nunca `float(None)`. (Lección: 3 errores 500 encadenados en Reportes/KPIs.)
*   **Errores visibles, nunca silenciosos:** prohibido `except: pass`. El frontend muestra estado de error/reintento, jamás una pantalla en blanco por `data` nulo.

## 7. Flujo Spec-Driven (SDD) y convenciones operativas
*   **La especificación es la fuente de verdad.** Toda feature nueva o cambio significativo sigue: `/speckit-specify` → `/speckit-clarify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-analyze` → `/speckit-implement`. (Skills en `.claude/skills/`; requieren abrir Claude Code con `erp-modular/` como raíz.)
*   **Una feature = una rama git.** Cada `specs/NNN-*` vive en su rama y se mergea solo con la compuerta en verde.
*   **Orden de rutas:** los endpoints literales (`/export`, `/import`, `/bulk`) se declaran SIEMPRE antes de las rutas con parámetro (`/{id}`) para evitar capturas erróneas del path.
*   **Scripts/health-checks locales:** usar `127.0.0.1`, no `localhost` (uvicorn bindea IPv4; `localhost` puede resolver a IPv6 `::1` y fallar).

---

## Governance
*   Esta constitución prevalece sobre cualquier otra práctica del repositorio. Las enmiendas se documentan aquí con fecha y se versionan (SemVer: MAJOR cambios incompatibles de principios; MINOR principios/secciones nuevos o ampliados; PATCH aclaraciones).
*   Los cambios de identidad de marca y de Design System son de nivel governance y se registran como enmiendas versionadas.
*   Toda revisión de código (humana o IA) debe verificar el cumplimiento de estos artículos. La complejidad debe justificarse; ante la duda, aplicar YAGNI.
*   La colaboración con Antigravity se mantiene según `COLLABORATION.md`: la spec es la fuente de verdad compartida.

**Version**: 1.1.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-19
