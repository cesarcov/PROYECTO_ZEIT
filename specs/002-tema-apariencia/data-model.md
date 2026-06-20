# Data Model: Sistema de temas

**Phase 1** · Branch `002-tema-apariencia` · 2026-06-20

## 1. Persistencia (PostgreSQL)

### Tabla `users` — nueva columna

| Campo | Tipo | Notas |
|---|---|---|
| `preferencias` | `JSONB` `DEFAULT '{}'` `NOT NULL` | Blob de preferencias del usuario. El tema vive en `preferencias->>'tema'`. |

Migración: `migrations/034_user_preferencias.sql` (idempotente, `ADD COLUMN IF NOT EXISTS`).

Valor del tema: uno de `system | zeit-claro | zeit-oscuro | zeit-oscuro-energia | zeit-turquesa | zeit-grafito`. Guarda defensiva: si falta o es inválido → `system`.

## 2. Modelo en frontend

- **Preferencia de tema (usuario):** `tema: string` (uno de los IDs de arriba). Fuente de verdad = cuenta (backend); caché de arranque = `localStorage["zeit_tema"]`.
- **Tema efectivo:** si `tema = "system"`, se resuelve a `zeit-claro` o `zeit-oscuro` según `prefers-color-scheme`. En otro caso, es el tema elegido.

## 3. Tokens (contrato de variables CSS)

Conjunto mínimo de tokens que cada tema MUST definir (ver `contracts/theme-tokens.md`):

`--bg`, `--surface`, `--surface-2`, `--text`, `--text-muted`, `--border`,
`--primary`, `--primary-contrast`, `--accent`, `--action`,
`--sidebar-bg`, `--sidebar-text`, `--sidebar-active`,
`--success`, `--warning`, `--danger`, `--info`.

**Regla FR-010:** `--bg`, `--surface*`, `--primary`, `--sidebar-bg` NUNCA usan el Naranja Energía. El naranja solo puede ser `--action` o `--accent`/`--sidebar-active`.

## 4. Catálogo de los 5 temas (valores base, afinables en implementación)

Paleta corporativa: Azul `#003A8C` · Azul Oscuro `#001F54` · Turquesa `#00D4D8` · Naranja `#FF6B00` · Gris `#5A6573`.

### 4.1 `zeit-claro` (claro, primario azul)
| token | valor | token | valor |
|---|---|---|---|
| --bg | `#F4F6FA` | --primary | `#003A8C` |
| --surface | `#FFFFFF` | --primary-contrast | `#FFFFFF` |
| --surface-2 | `#EEF2F8` | --accent | `#00D4D8` |
| --text | `#0F1B2D` | --action | `#FF6B00` |
| --text-muted | `#5A6573` | --sidebar-bg | `#001F54` |
| --border | `#E2E8F0` | --sidebar-text | `#C7D2E5` |
| | | --sidebar-active | `#003A8C` |

### 4.2 `zeit-oscuro` (oscuro navy, acento turquesa)
| token | valor | token | valor |
|---|---|---|---|
| --bg | `#001229` | --primary | `#1E5FC0` |
| --surface | `#001F54` | --primary-contrast | `#FFFFFF` |
| --surface-2 | `#042A63` | --accent | `#00D4D8` |
| --text | `#E6EDF7` | --action | `#FF6B00` |
| --text-muted | `#8A98B0` | --sidebar-bg | `#001229` |
| --border | `#0C2E63` | --sidebar-text | `#C7D2E5` |
| | | --sidebar-active | `#00D4D8` |

### 4.3 `zeit-oscuro-energia` (oscuro, acento NARANJA en navegación activa)
| token | valor | token | valor |
|---|---|---|---|
| --bg | `#001229` | --primary | `#1E5FC0` |
| --surface | `#001F54` | --primary-contrast | `#FFFFFF` |
| --surface-2 | `#042A63` | --accent | `#FF6B00` |
| --text | `#E6EDF7` | --action | `#FF6B00` |
| --text-muted | `#8A98B0` | --sidebar-bg | `#001229` |
| --border | `#0C2E63` | --sidebar-text | `#C7D2E5` |
| | | --sidebar-active | `#FF6B00` |

> Naranja solo como acento/activo; el fondo y el primario siguen siendo azules (cumple FR-010).

### 4.4 `zeit-turquesa` (claro-medio, acento turquesa dominante)
| token | valor | token | valor |
|---|---|---|---|
| --bg | `#F0FBFC` | --primary | `#003A8C` |
| --surface | `#FFFFFF` | --primary-contrast | `#FFFFFF` |
| --surface-2 | `#E3F6F8` | --accent | `#00D4D8` |
| --text | `#0A2A2E` | --action | `#FF6B00` |
| --text-muted | `#5A6573` | --sidebar-bg | `#053640` |
| --border | `#CDEBEE` | --sidebar-text | `#C7E9EC` |
| | | --sidebar-active | `#00D4D8` |

### 4.5 `zeit-grafito` (grafito, sobrio, alto contraste)
| token | valor | token | valor |
|---|---|---|---|
| --bg | `#2B303A` | --primary | `#4D8DF0` |
| --surface | `#353B47` | --primary-contrast | `#06121F` |
| --surface-2 | `#3F4654` | --accent | `#00D4D8` |
| --text | `#F1F4F8` | --action | `#FF6B00` |
| --text-muted | `#A7B0BE` | --sidebar-bg | `#21252E` |
| --border | `#4A5160` | --sidebar-text | `#C7CDD8` |
| | | --sidebar-active | `#4D8DF0` |

> Tokens de estado comunes (sugeridos, ajustables por tema): `--success #16A34A`, `--warning #CA8A04`, `--danger #DC2626`, `--info` = `--accent`.
