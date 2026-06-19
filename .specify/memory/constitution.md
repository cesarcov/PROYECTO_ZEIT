# Constitución del Proyecto: CeShark ERP Modular

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
*   **Paleta de Colores Corporativa (Design System):**
    *   Fondo principal: `#0B2E33`
    *   Color de acento: `#B8E3E9`
    *   Elementos interactivos / botones secundarios: `#4F7C82`
*   **Estilos y Tailwind:**
    *   Se utiliza Tailwind CSS v4 para utilidades generales en componentes atómicos.
    *   En las vistas principales (`pages/`), se priorizan **estilos inline usando objetos de Javascript** para componentes contenedores principales con el fin de asegurar flexibilidad en el diseño premium y evitar saturar el marcado HTML.
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
*   Esta constitución prevalece sobre cualquier otra práctica del repositorio. Las enmiendas se documentan aquí con fecha y se versionan.
*   Toda revisión de código (humana o IA) debe verificar el cumplimiento de estos artículos. La complejidad debe justificarse; ante la duda, aplicar YAGNI.
*   La colaboración con Antigravity se mantiene según `COLLABORATION.md`: la spec es la fuente de verdad compartida.

**Version**: 1.0.0 | **Ratified**: 2026-06-11 | **Last Amended**: 2026-06-11
