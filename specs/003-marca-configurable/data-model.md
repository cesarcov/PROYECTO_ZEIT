# Data Model: Marca configurable

**Phase 1** · Branch `003-marca-configurable` · 2026-06-20

## Entidad nueva — tabla `branding` (singleton)

Migración `035_branding.sql`. Una sola fila (`id = 1`). Todos los campos de marca son **nullable**: `NULL` = usar el valor ZEIT por defecto.

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | INT PK, `CHECK (id = 1)` | Fuerza fila única. |
| `nombre_producto` | TEXT, null | Nombre mostrado (ej. "ACME ERP"). |
| `eslogan` | TEXT, null | Eslogan bajo el logo. |
| `logo_incluye_nombre` | BOOLEAN, default TRUE | `true` = el logo ya trae el nombre (mostrar solo imagen); `false` = mostrar el nombre como texto. |
| `color_primario` | TEXT, null | Color de marca (hex). |
| `color_acento` | TEXT, null | Color de acento (hex). |
| `color_accion` | TEXT, null | Color de acción/CTA (hex). |
| `logo_claro_path` | TEXT, null | Ruta del logo para fondos claros. |
| `logo_oscuro_path` | TEXT, null | Ruta del logo para fondos oscuros. |
| `isotipo_path` | TEXT, null | Ruta del isotipo (versión chica). |
| `favicon_path` | TEXT, null | Ruta del favicon. |
| `updated_at` | TIMESTAMP | Última edición. |

```sql
CREATE TABLE IF NOT EXISTS branding (
  id INT PRIMARY KEY DEFAULT 1,
  nombre_producto TEXT,
  eslogan TEXT,
  logo_incluye_nombre BOOLEAN DEFAULT TRUE,
  color_primario TEXT,
  color_acento TEXT,
  color_accion TEXT,
  logo_claro_path TEXT,
  logo_oscuro_path TEXT,
  isotipo_path TEXT,
  favicon_path TEXT,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT branding_singleton CHECK (id = 1)
);
INSERT INTO branding (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
```

## Forma de la respuesta pública (`GET /branding`)

```json
{
  "appName": "ZEIT SOLUTIONS",          // nombre_producto o default
  "tagline": "Confiabilidad...",         // eslogan o default
  "logoIncluyeNombre": true,             // si false → mostrar appName como texto
  "colors": { "primary": "#003A8C", "accent": "#00D4D8", "action": "#FF6B00" }, // o null por campo
  "logos": {
    "claro":   "/branding-assets/logo-claro.png"  | null,
    "oscuro":  "/branding-assets/logo-oscuro.png" | null,
    "icono":   "/branding-assets/isotipo.png"     | null,
    "favicon": "/branding-assets/favicon.png"     | null
  },
  "poweredBy": "Powered by CeShark · ERP Engine"   // FIJO, no editable
}
```

- Campos en `null` → el frontend usa el **default ZEIT** (logos de `frontend/public`, paleta de `themes.css`).
- `poweredBy` siempre presente y constante (FR-009).

## Reglas de validación

- **Color** (`color_*`): cadena de color válida (hex `#RGB` / `#RRGGBB`). Inválido → 422, conserva el anterior.
- **Imagen** (`logo/isotipo/favicon`): formato **PNG/JPG** (verificado con Pillow) o **SVG** (XML con `<svg`); tamaño **≤ 2 MB**. Inválido → 422, conserva la anterior.
- Restablecer (`DELETE /branding`): limpia campos a `NULL` y borra archivos → vuelve a ZEIT.

## Aplicación en el frontend (resumen)

- **Colores**: `--primary` / `--accent` / `--action` se fijan en `document.documentElement` (override de todos los temas).
- **Logos/nombre/eslogan**: los consume `brand.js` → `ZeitLogo` (feature 002), que ya soporta imagen + variante clara/oscura.
- **Título + favicon**: se aplican al `document.title` y al `<link rel="icon">`.
