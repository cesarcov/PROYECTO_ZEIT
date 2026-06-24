# Implementation Plan: Marca configurable (white-label)

**Branch**: `003-marca-configurable` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-marca-configurable/`

## Summary

Mover la identidad del ERP de un archivo local (feature 002) a una **configuración de marca en el servidor**, editable por el **admin (`admin:*`)** desde el panel: nombre, eslogan, logos (claro/oscuro/isotipo), favicon y **colores corporativos** (primario/acento/acción). La marca se lee con un endpoint **público** (el login la necesita antes de autenticar) y se aplica en todo el ERP. Los colores se inyectan como variables CSS sobre la raíz, sobrescribiendo los tokens de los 5 temas. Si no hay nada configurado, se usan los valores ZEIT por defecto. El crédito "Powered by CeShark" es fijo.

## Technical Context

**Language/Version**: Python 3.11 (FastAPI, psycopg2) · React 18 + Vite

**Primary Dependencies**: FastAPI (`UploadFile`, `StaticFiles`, `FileResponse`), psycopg2, Pillow (validación de imagen, ya instalado) · React + ThemeProvider (feature 002)

**Storage**: PostgreSQL — tabla **singleton** `branding` (una fila). Imágenes subidas en disco: `app/storage/branding/` (carpeta de runtime, ya ignorada por git).

**Testing**: pytest (`tests/smoke`) + `npm run build`, vía `verify.ps1`

**Target Platform**: Servidor web (uvicorn) + SPA navegador

**Project Type**: Aplicación web (FastAPI + React)

**Performance Goals**: N/A — config de marca es lectura ocasional, cacheable.

**Constraints**:
- `GET /branding` MUST ser **público** (el login muestra la marca antes de autenticar).
- Escrituras de marca solo **admin**; uploads validados (PNG/SVG/JPG, ≤2 MB).
- Los colores corporativos sobrescriben los tokens en **todos los temas** sin romper contraste.
- Cero regresión: sin marca configurada → identidad ZEIT por defecto (feature 002).

**Scale/Scope**: 1 módulo backend nuevo + 1 migración + 1 página de admin + bootstrap de marca en el frontend.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Artículo | Cumplimiento |
|---|---|
| **1. SQL solo en service** | ✅ Todo el SQL en `branding/service.py`; el router solo orquesta. |
| **2. Frontend por tokens** | ✅ Los colores corporativos se aplican como variables CSS (override de tokens); sin hex hardcodeado nuevo. |
| **3. Migraciones** | ✅ `035_branding.sql` idempotente (`CREATE TABLE IF NOT EXISTS` + fila singleton). |
| **4. Permisos** | ✅ Escrituras con `require_permission("admin:users")` (gate admin existente). **Excepción justificada**: `GET /branding` es público porque el login lo necesita pre-autenticación (solo expone identidad visual, no datos sensibles). |
| **5. Compuerta + smoke tests** | ✅ Smoke: `GET /branding` 200, `PUT` admin 200, `PUT` sin permiso → 401/403, upload inválido → 422. |
| **6. Esquema real + nulos defensivos** | ✅ Campos nullable → null = usar default; validación de imagen (formato/tamaño) y de color. |
| **Marca por defecto** | ✅ Sin config → ZEIT (feature 002); crédito "Powered by CeShark" fijo (FR-009). |

**Resultado**: Sin violaciones. La única desviación (GET público) está justificada y acotada a la identidad visual.

## Project Structure

### Documentation (this feature)

```text
specs/003-marca-configurable/
├── plan.md · research.md · data-model.md · quickstart.md
├── contracts/branding-api.md
└── tasks.md   (lo genera /speckit-tasks)
```

### Source Code — archivos que se tocan

```text
app/modules/branding/            # NUEVO módulo
├── __init__.py
├── router.py     # GET /branding (público) + PUT/POST/DELETE (admin)
├── service.py    # SQL singleton + guardar/validar imágenes
└── schemas.py    # BrandingUpdate (nombre, eslogan, colores)
app/main.py       # include branding_router + mount StaticFiles "/branding-assets"
migrations/035_branding.sql       # tabla singleton branding
app/storage/branding/             # imágenes subidas (runtime, gitignored)

frontend/myapp/src/
├── branding/brand.js             # resolver: fetch GET /branding + defaults ZEIT + caché
├── theme/ThemeProvider.jsx       # aplica colores corporativos (CSS vars sobre la raíz)
├── main.jsx / App.jsx            # bootstrap: cargar marca + aplicar título/favicon
├── pages/admin/AdminBranding.jsx # NUEVO: formulario de marca (admin)
├── components/Layout.jsx         # ítem "Marca" en el menú Admin
└── App.jsx                       # ruta /admin/branding

tests/smoke/test_endpoints.py     # endpoints de branding
```

**Structure Decision**: Módulo backend nuevo (`branding`) con el patrón router/service/schemas. Las imágenes subidas se sirven como estáticos desde `app/storage/branding/`; la marca por defecto (ZEIT) sigue en `frontend/public`. El frontend resuelve la marca al arrancar y cae a los defaults si el backend no devuelve nada.

## Complexity Tracking

> Sin violaciones de constitución que justificar. (El GET público está documentado en el Constitution Check.)
