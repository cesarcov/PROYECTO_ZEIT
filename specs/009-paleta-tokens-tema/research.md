# Research: Sistema de Paleta Corporativa y Tokens de Tema

**Feature**: 009-paleta-tokens-tema
**Fecha**: 2026-07-05

---

## Estado actual del sistema (auditoría pre-implementación)

### Themes existentes en `src/theme/themes.css`

| ID de tema | Descripción | `--bg` actual | Decisión |
|---|---|---|---|
| `zeit-claro` | Tema claro (default) | `#F4F6FA` | **MANTENER** |
| `zeit-oscuro` | Tema oscuro | `#06152E` | **MODIFICAR** — demasiado oscuro; ajustar a `#001F54` |
| `zeit-oscuro-energia` | Oscuro con naranja | `#06152E` | **ELIMINAR** |
| `zeit-turquesa` | Claro turquesa | `#F0FBFC` | **ELIMINAR** |
| `zeit-grafito` | Gris oscuro | `#262B34` | **ELIMINAR** |

**Decisión**: Reducir a 2 temas canónicos. El catálogo `TEMAS` en `ThemeProvider.jsx` se simplifica a:
```js
[
  { id: "zeit-claro",  label: "Claro"  },
  { id: "zeit-oscuro", label: "Oscuro" },
]
```
La opción `"system"` (seguir OS) se elimina del catálogo visible; si se desea en el futuro es una enmienda constitucional.

---

### Tokens de color actuales en backend (`branding`)

| Campo en DB | Token CSS | Default ZEIT |
|---|---|---|
| `color_primario` | `--primary` | `#003A8C` |
| `color_acento` | `--accent` | `#00D4D8` |
| `color_accion` | `--action` | `#FF6B00` |
| **FALTA** | `--text-muted` / `--color-text-secondary` | `#5A6573` |

**Decisión**: Agregar columna `color_texto_secundario VARCHAR(7)` a la tabla `branding` vía migración.
La nueva columna se expone en `GET /branding` como `colors.textSecondary`.

---

### Arquitectura CSS actual

El archivo `themes.css` ya usa la convención `[data-theme="id"] { --var: valor; }` correctamente.
Los componentes consumen `var(--primary)`, `var(--accent)`, `var(--action)`, `var(--text-muted)`, etc.

**Gap encontrado**: Los tokens de branding (colores custom de la empresa) NO se inyectan
como variables CSS en tiempo de ejecución. Cuando el admin guarda `color_primario`, los componentes
no ven ese valor en `--primary`. Esto debe corregirse: al cargar branding, si hay colores custom,
se aplican via `document.documentElement.style.setProperty("--primary", value)`.

**Decisión**: La inyección de tokens de branding se hace en el punto de carga de branding
(ya existente en `Layout.jsx` o en un hook dedicado `useBrandingTokens`).

---

### Equilibrio visual: "no todo oscuro, no todo claro"

**Problema del tema oscuro actual** (`zeit-oscuro`):
- `--bg: #06152E` es muy oscuro (casi negro), dando sensación de "apagado".
- El Azul Oscuro corporativo `#001F54` es más rico y reconocible como azul navy.

**Decisión para el tema oscuro ajustado**:

| Token | Valor actual | Valor propuesto | Razón |
|---|---|---|---|
| `--bg` | `#06152E` | `#001F54` | Base corporativa ZEIT (Art. 2) |
| `--surface` | `#0C2350` | `#0D2545` | Un tono encima del base |
| `--surface-2` | `#143266` | `#163770` | Para paneles anidados |
| `--text` | `#EAF1FB` | `#E8EEF9` | Near-white con tinte azul |
| `--text-muted` | `#A7B6D0` | `#9AAFC5` | Legible sobre fondo oscuro |
| `--border` | `#1B3D72` | `#1E3F70` | Separadores suaves |
| `--sidebar-bg` | `#050F22` | `#001240` | Una parada más oscura que el bg |
| `--primary` | `#2D6FD6` | `#4A8CE8` | Más visible sobre azul navy |

**Decisión para el tema claro** (ya bien equilibrado):
- Mantener `--bg: #F4F6FA` (no blanco puro).
- Mantener sidebar con `--sidebar-bg: #001F54` (contraste sano, look profesional).
- Solo ajuste: asegurar que `--text-muted` derive del token de branding `color_texto_secundario`.

---

### Validación de contraste (WCAG 2.1 AA)

La fórmula de luminancia relativa (L = 0.2126R + 0.7152G + 0.0722B) es estándar.
Se implementa como función JS pura en el frontend, sin dependencias externas.
El ratio 4.5:1 cubre texto normal; 3:1 es suficiente para texto grande (≥18pt).

**Decisión**: Usar ratio ≥ 4.5:1 para todos los textos (política conservadora).
La función `checkContrast(hex1, hex2)` retorna `{ ratio, passes }`.

---

### Migración de base de datos

Número de migración siguiente: `041` (el último es `040_user_block_permissions.sql` per CLAUDE.md).

```sql
-- 041_branding_color_texto_secundario.sql
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS color_texto_secundario VARCHAR(7);
```

---

## Decisiones finales

| Área | Decisión |
|---|---|
| Temas | 2 únicos: `zeit-claro` y `zeit-oscuro`. Eliminar los 4 extras. |
| Tokens de color | 4: primario, acento, acción, texto-secundario. Añadir 4to al backend. |
| Inyección de branding | JS runtime via `setProperty`. Se ejecuta al montar el Layout. |
| Tema oscuro | Usar `#001F54` como base `--bg` (no `#06152E`). |
| Validación contraste | Función `checkContrast()` en AdminBranding, bloquea si ratio < 4.5:1. |
| Migración | `041_branding_color_texto_secundario.sql` — ADD COLUMN sin breaking change. |
