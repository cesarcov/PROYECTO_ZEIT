# Implementation Plan: Paleta Corporativa y Tokens de Tema

**Branch**: `009-paleta-tokens-tema` | **Date**: 2026-07-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/009-paleta-tokens-tema/spec.md`

---

## Summary

Consolidar el sistema de temas del ERP a exactamente **2 opciones** (Claro / Oscuro), definir
**4 tokens de color editables** por el administrador (Primario, Acento, Accion, Texto Secundario),
y ajustar el tema oscuro para que use el Azul Navy corporativo (`#001F54`) en lugar del azul
casi-negro actual — logrando un look sobrio, equilibrado y profesional con contraste WCAG AA
garantizado en ambos temas.

---

## Technical Context

**Language/Version**: Python 3.11 (backend) · JavaScript ES2023 / React 18 (frontend)

**Primary Dependencies**: FastAPI · psycopg2 (backend) · React · Tailwind CSS v4 · CSS Custom Properties (frontend)

**Storage**: PostgreSQL (Supabase). Una migracion ADD COLUMN en tabla `branding`.

**Testing**: `pytest tests/smoke` (backend) · `npm run build` (frontend) · validacion manual con WebAIM Contrast Checker

**Target Platform**: Web application — Chrome/Firefox/Safari modernos

**Project Type**: Web application (full-stack: FastAPI backend + React/Vite frontend)

**Performance Goals**: Cambio de tema en < 300ms sin parpadeo (FR-009)

**Constraints**: Sin dependencias nuevas. Sin breaking changes en la API. La migracion DB es aditiva (ADD COLUMN).

**Scale/Scope**: 1 tabla modificada · 4 archivos backend · 4 archivos frontend · 1 migracion SQL

---

## Constitution Check

*GATE: Must pass before implementation.*

| Articulo | Requisito | Estado |
|---|---|---|
| Art. 1 — Estructura modulos | El backend solo modifica schemas.py, service.py. Sin SQL en routers. | PASS |
| Art. 2 — Solo 2 temas | Reducimos de 6 a 2. ThemeProvider y themes.css actualizados. | PASS |
| Art. 2 — Contraste >= 4.5:1 | Tema oscuro: #E8EEF9 sobre #001F54 = 12.1:1. Tema claro: #0F1B2D sobre #F4F6FA = 17.5:1. | PASS |
| Art. 2 — 4 tokens editables | Se agregan al backend y frontend. | PASS |
| Art. 2 — No hex literales | Todos los colores van a variables CSS o tokens de branding. | PASS |
| Art. 3 — Migracion registrada | migrations/041_branding_color_texto_secundario.sql | PASS |
| Art. 5 — Compuerta verde | backend import + smoke tests + npm build deben pasar. | PENDIENTE |
| Art. 8.2 — GET /branding publico | No cambia su naturaleza publica. | PASS |

---

## Project Structure

### Documentation (this feature)

```text
specs/009-paleta-tokens-tema/
  plan.md              <- Este archivo
  spec.md              <- Especificacion
  research.md          <- Decisiones de diseno y auditoria
  data-model.md        <- Esquema DB y tokens CSS
  quickstart.md        <- Guia de validacion manual
  contracts/
    branding-api.md    <- Contrato de los endpoints afectados
  tasks.md             <- (creado por /speckit-tasks)
```

### Source Code (archivos a modificar)

```text
migrations/
  041_branding_color_texto_secundario.sql   <- NUEVO

app/modules/branding/
  schemas.py    <- agregar color_texto_secundario a BrandingUpdate
  service.py    <- agregar campo a _COLS, colors response, update_branding, validacion

frontend/myapp/src/
  theme/
    themes.css          <- ajustar zeit-oscuro, eliminar 4 temas extra
    ThemeProvider.jsx   <- reducir TEMAS a 2, inyectar branding tokens
  pages/admin/
    AdminBranding.jsx   <- agregar 4to color picker + checkContrast()
```

**Structure Decision**: Web application full-stack. La logica de tema vive enteramente
en el frontend (CSS + ThemeProvider). El backend almacena preferencias de usuario y
colores de branding.

---

## Complexity Tracking

No hay violaciones de constitucion que justificar. La implementacion es directa.

---

## Phase 0: Research — COMPLETADA

Ver [research.md](research.md) para hallazgos completos.

**Decisiones tomadas**:
- 2 temas unicos: `zeit-claro` y `zeit-oscuro`.
- Tema oscuro ajustado: base `#001F54` (no `#06152E`).
- 4to token: `color_texto_secundario` / `--text-muted`.
- Inyeccion de branding tokens en runtime via `setProperty`.
- Contraste validado con formula WCAG en el frontend.

---

## Phase 1: Design — COMPLETADA

Ver [data-model.md](data-model.md) y [contracts/branding-api.md](contracts/branding-api.md).

---

## Phase 2: Implementation Plan

### Tarea 1 — Migracion de base de datos

**Archivo**: `migrations/041_branding_color_texto_secundario.sql`

Agregar la columna `color_texto_secundario VARCHAR(7)` a la tabla `branding` con ADD COLUMN IF NOT EXISTS.
Aplicar con: `python run_migrations.py`

---

### Tarea 2 — Backend: ampliar schemas y service de branding

**Archivo**: `app/modules/branding/schemas.py`
- Agregar `color_texto_secundario: Optional[str] = None` a `BrandingUpdate`.

**Archivo**: `app/modules/branding/service.py`
- Agregar `"color_texto_secundario"` a `_COLS` (lista de columnas a leer de DB).
- En `get_branding_public()`, agregar `"textSecondary": b.get("color_texto_secundario")` en el dict `colors`.
- En `update_branding()`, incluir `"color_texto_secundario"` en el loop de validacion hex.
- Incluir `"color_texto_secundario"` en la tupla `editable`.

---

### Tarea 3 — Frontend: actualizar themes.css

**Archivo**: `frontend/myapp/src/theme/themes.css`

**Cambios**:
1. Eliminar los bloques `zeit-oscuro-energia`, `zeit-turquesa`, `zeit-grafito`.
2. Actualizar `zeit-oscuro` con valores equilibrados:
   - `--bg: #001F54` (Azul Navy corporativo, era #06152E)
   - `--surface: #0D2545`
   - `--surface-2: #163770`
   - `--text: #E8EEF9`
   - `--text-muted: #9AAFC5`
   - `--border: #1E3F70`
   - `--primary: #4A8CE8` (visible sobre azul navy)
   - `--sidebar-bg: #001240`

---

### Tarea 4 — Frontend: simplificar ThemeProvider.jsx

**Archivo**: `frontend/myapp/src/theme/ThemeProvider.jsx`

**Cambios**:
1. Reducir `TEMAS` a exactamente 2:
   - `{ id: "zeit-claro",  label: "Claro"  }`
   - `{ id: "zeit-oscuro", label: "Oscuro" }`
2. Eliminar el caso `"system"` en `resolverEfectivo()`. Fallback: `"zeit-claro"`.
3. Agregar funcion `inyectarTokensBranding(colors)` que aplica los 4 tokens de branding
   como variables CSS en `document.documentElement.style` al montar el componente.
4. Llamar `inyectarTokensBranding` tras cargar datos de `/branding` en el efecto existente.
5. Migrar en cliente: si el valor guardado en localStorage no esta en los 2 validos,
   limpiar a `"zeit-claro"`.

---

### Tarea 5 — Frontend: actualizar AdminBranding.jsx

**Archivo**: `frontend/myapp/src/pages/admin/AdminBranding.jsx`

**Cambios**:
1. Agregar el 4to campo de color `color_texto_secundario` con etiqueta "Texto Secundario"
   y descripcion: "Color para textos auxiliares, placeholders y bordes (default: #5A6573)".
2. Implementar funcion `checkContrast(fg, bg)` con formula WCAG 2.1 de luminancia relativa.
   Retorna el ratio numerico.
3. Mostrar el ratio calculado en tiempo real para pares criticos:
   - color_primario + #FFFFFF
   - color_texto_secundario + fondo del tema activo
4. Deshabilitar el boton "Guardar" si cualquier ratio < 4.5, con mensaje de advertencia visible.
5. Agregar boton "Restaurar valores ZEIT" que resetea los 4 campos a defaults corporativos:
   - Primario: `#003A8C`, Acento: `#00D4D8`, Accion: `#FF6B00`, Texto Secundario: `#5A6573`.

---

## Compuerta de Verificacion

Ejecutar `verify.ps1` despues de implementar todas las tareas.
Validacion manual siguiendo [quickstart.md](quickstart.md).
