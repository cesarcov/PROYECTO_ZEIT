# Contract: Tokens de tema (variables CSS)

**Phase 1** · Branch `002-tema-apariencia` · 2026-06-20

Contrato de los nombres de tokens que TODO tema debe definir y que el armazón (y, en tramos siguientes, todas las vistas) debe consumir vía `var(--token)`.

## Aplicación

- El tema activo se fija con `document.documentElement.dataset.theme = "<id>"` (atributo `data-theme` en `<html>`).
- Cada tema vive en `src/theme/themes.css` como `[data-theme="<id>"] { --token: valor; … }`.
- Los componentes NO usan hex literal; usan `var(--token)` (en estilos inline: `style={{ background: "var(--surface)" }}`).

## Tokens obligatorios

| Token | Uso |
|---|---|
| `--bg` | Fondo general de la app |
| `--surface` | Tarjetas, paneles, modales |
| `--surface-2` | Superficies elevadas / encabezados de sección |
| `--text` | Texto principal |
| `--text-muted` | Texto secundario / descripciones |
| `--border` | Bordes y separadores |
| `--primary` | Color de marca primario (acciones principales, énfasis) — **nunca naranja** |
| `--primary-contrast` | Texto/iconos sobre `--primary` |
| `--accent` | Acento (turquesa o, en el tema energía, naranja) |
| `--action` | Botones de acción/CTA, alertas — único lugar donde el naranja es válido por defecto |
| `--sidebar-bg` | Fondo de la barra lateral — **nunca naranja** |
| `--sidebar-text` | Texto de la barra lateral |
| `--sidebar-active` | Ítem de navegación activo |
| `--success` `--warning` `--danger` `--info` | Estados |

## Reglas

1. **FR-010:** el Naranja Energía `#FF6B00` solo puede asignarse a `--action`, `--accent` (tema energía) o `--sidebar-active` (tema energía). Nunca a `--bg`, `--surface*`, `--primary` ni `--sidebar-bg`.
2. Todo tema MUST definir el conjunto completo de tokens (sin huecos), para que ninguna pantalla quede sin color.
3. Contraste objetivo WCAG AA (≥ 4.5:1) para `--text` sobre `--bg` y `--surface` (SC-003).
