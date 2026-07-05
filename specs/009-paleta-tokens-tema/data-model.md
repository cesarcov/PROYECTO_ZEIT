# Data Model: Sistema de Paleta Corporativa y Tokens de Tema

**Feature**: 009-paleta-tokens-tema
**Fecha**: 2026-07-05

---

## Entidades afectadas

### 1. Tabla `branding` (modificada)

**Cambio**: agregar columna `color_texto_secundario`.

```sql
-- Estado final de la tabla branding (columnas de color):
color_primario         VARCHAR(7)  -- hex, ej. "#003A8C". NULL = default ZEIT
color_acento           VARCHAR(7)  -- hex, ej. "#00D4D8". NULL = default ZEIT
color_accion           VARCHAR(7)  -- hex, ej. "#FF6B00". NULL = default ZEIT
color_texto_secundario VARCHAR(7)  -- hex, ej. "#5A6573". NULL = default ZEIT  ← NUEVA
```

**Restricciones**:
- Debe ser `NULL` o un valor hex válido (`#RRGGBB` o `#RGB`).
- NULL significa "usar el default ZEIT corporativo".
- Singleton: solo existe la fila `id=1`.

**Migración**: `migrations/041_branding_color_texto_secundario.sql`
```sql
ALTER TABLE branding
  ADD COLUMN IF NOT EXISTS color_texto_secundario VARCHAR(7);
```

---

### 2. Preferencia de tema del usuario (sin cambios de esquema)

La preferencia se persiste en la tabla existente de preferencias de usuario.
Solo cambian los valores válidos:

| Antes | Después |
|---|---|
| `"system"`, `"zeit-claro"`, `"zeit-oscuro"`, `"zeit-oscuro-energia"`, `"zeit-turquesa"`, `"zeit-grafito"` | `"zeit-claro"`, `"zeit-oscuro"` |

Los usuarios con preferencia `"system"`, `"zeit-oscuro-energia"`, `"zeit-turquesa"` o `"zeit-grafito"` almacenada se migran automáticamente:
- `"system"` → `"zeit-claro"` (el fallback conservador)
- `"zeit-oscuro-energia"` → `"zeit-oscuro"`
- `"zeit-turquesa"` → `"zeit-claro"`
- `"zeit-grafito"` → `"zeit-oscuro"`

**Migración de datos** (incluida en la misma migración o ejecutada al arrancar el ThemeProvider):
```sql
UPDATE user_preferences
  SET preferences = jsonb_set(
    preferences,
    '{tema}',
    CASE
      WHEN preferences->>'tema' IN ('zeit-oscuro-energia', 'zeit-grafito') THEN '"zeit-oscuro"'
      ELSE '"zeit-claro"'
    END
  )
WHERE preferences->>'tema' NOT IN ('zeit-claro', 'zeit-oscuro');
```

---

## Tokens CSS (contrato de design system)

Estos son los nombres de variables CSS que todos los componentes deben consumir.
Se definen en `themes.css` y se sobreescriben en tiempo de ejecución cuando el admin
configura colores custom.

### Tokens editables por el admin (4 tokens de branding)

| Variable CSS | Campo DB | Default ZEIT (claro) | Default ZEIT (oscuro) |
|---|---|---|---|
| `--primary` | `color_primario` | `#003A8C` | `#4A8CE8` |
| `--accent` | `color_acento` | `#00D4D8` | `#00D4D8` |
| `--action` | `color_accion` | `#FF6B00` | `#FF6B00` |
| `--text-muted` | `color_texto_secundario` | `#5A6573` | `#9AAFC5` |

> **Nota**: En tema oscuro, el `--text-muted` tiene un valor base diferente para mantener
> contraste. Si el admin configura `color_texto_secundario`, ese valor se usa en ambos temas;
> el sistema verifica que el contraste sea ≥ 4.5:1 en el tema activo antes de guardar.

### Tokens derivados (no editables directamente, calculados automáticamente)

| Variable CSS | Cómo se calcula |
|---|---|
| `--primary-soft` | `color-mix(in srgb, var(--primary) 12%, transparent)` |
| `--primary-dark` | `color-mix(in srgb, var(--primary) 60%, #000)` |
| `--primary-contrast` | Blanco (`#FFFFFF`) en todos los temas actuales |

### Tokens de superficie (fijos por tema, no editables por admin)

| Variable CSS | Tema Claro | Tema Oscuro |
|---|---|---|
| `--bg` | `#F4F6FA` | `#001F54` |
| `--surface` | `#FFFFFF` | `#0D2545` |
| `--surface-2` | `#EEF2F8` | `#163770` |
| `--text` | `#0F1B2D` | `#E8EEF9` |
| `--border` | `#E2E8F0` | `#1E3F70` |
| `--sidebar-bg` | `#001F54` | `#001240` |
| `--sidebar-text` | `#C7D2E5` | `#C7D2E5` |
| `--sidebar-active` | `#003A8C` | `#00D4D8` |

---

## Reglas de validación de contraste

Función `checkContrast(fgHex, bgHex)` a implementar en el frontend:

```
Input:  dos colores hex (#RRGGBB)
Output: { ratio: number, passes: boolean }

Algoritmo (WCAG 2.1):
  1. Convertir cada hex a componentes RGB linealizados
  2. Calcular luminancia relativa: L = 0.2126R + 0.7152G + 0.0722B
  3. ratio = (Lmax + 0.05) / (Lmin + 0.05)
  4. passes = ratio >= 4.5
```

**Pares que se validan al guardar branding**:
- `color_primario` sobre `--bg` del tema activo
- `color_texto_secundario` sobre `--bg` del tema activo
- `color_accion` sobre `#FFFFFF` (texto de botón primario siempre es blanco)
