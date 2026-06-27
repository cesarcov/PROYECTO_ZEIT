# Auditoría de Color del Frontend — ERP ZEIT

**Fecha:** 2026-06-26
**Alcance:** `frontend/myapp/src` (todos los `.jsx`)
**Tipo:** Auditoría de solo lectura (no se modificó nada)

---

## 1. Resumen ejecutivo

- **Sí existe una paleta corporativa bien definida** como tokens CSS en `src/theme/themes.css` (5 temas sobre la misma base). Está bien pensada (incluso con reglas de uso).
- **Pero ~98% del UI no la usa:** se contaron **+2,271 colores escritos a mano** (hex fijo) en **40+ archivos**, contra solo **45 usos de los tokens** (`var(--primary)`, etc.) en 3 archivos (menú, login, panel de branding).
- **Hallazgo principal:** una **paleta "petróleo/teal"** (`#0b2e33`, `#4f7c82` y derivados, ~800+ usos) funciona como color **primario/acento de facto en 57 archivos** (casi toda la app), **en lugar del azul ZEIT**. Esta es la causa #1 de que el ERP "no se sienta de marca".
- **Azules genéricos** (no el `#003A8C` corporativo) en 32 archivos.
- **Grises genéricos de Tailwind** (no los neutros azulados de ZEIT) en casi todo.
- **Lo bueno:** los colores **semánticos** (rojo=error, verde=éxito, amarillo=aviso) en su mayoría **ya coinciden** con tus tokens o son intencionales → bajo riesgo.

**Consecuencias del estado actual:**
1. Colores fuera de marca (verdes petróleo, azules genéricos).
2. Esas pantallas **no reaccionan** al cambio de tema ni a un override de branding del admin.

---

## 2. Tu paleta corporativa (referencia — `themes.css`, tema "ZEIT Claro")

| Token | Hex | Uso previsto |
|---|---|---|
| `--primary` | `#003A8C` | Azul ZEIT — elementos y botones principales |
| `--sidebar-bg` | `#001F54` | Navy — barra lateral / menú |
| `--action` | `#FF6B00` | Naranja Energía — llamadas a la acción |
| `--accent` | `#00D4D8` | Turquesa — acentos / realces |
| `--bg` | `#F4F6FA` | Fondo de la app |
| `--surface` | `#FFFFFF` | Tarjetas / superficies |
| `--surface-2` | `#EEF2F8` | Superficie secundaria |
| `--text` | `#0F1B2D` | Texto principal |
| `--text-muted` | `#5A6573` | Texto secundario |
| `--border` | `#E2E8F0` | Bordes |
| `--success` | `#16A34A` | Éxito |
| `--warning` | `#CA8A04` | Aviso |
| `--danger` | `#DC2626` | Error / peligro |

> Regla documentada en el código: el Naranja `#FF6B00` solo en acción/acento, nunca en fondos ni en el azul primario.

---

## 3. Clasificación de los colores realmente en uso

### 🔴 FUERA DE MARCA — migrar (prioridad ALTA)

**Familia petróleo/teal** (el problema grande, ~800+ usos):

| Hex en uso | Usos aprox. | Qué es hoy | → Token destino |
|---|---|---|---|
| `#0b2e33` | 302 | Petróleo muy oscuro (usado como "primary") | `--primary` o `--text` (si es texto) |
| `#4f7c82` | 296 | Teal grisáceo (usado como "accent") | `--accent` o `--primary` |
| `#b8e3e9` | 65 | Teal claro (fondos de acento) | `--surface-2` / acento suave |
| `#f0f9fa` | 47 | Teal casi blanco (fondos) | `--bg` / `--surface-2` |
| `#eef7f8` | 44 | Teal muy claro (fondos) | `--bg` / `--surface-2` |
| `#93b1b5` | 37 | Teal apagado | `--text-muted` / `--border` |
| `#0f766e` | 15 | Teal Tailwind | `--accent` |
| `#eef6f7` | 11 | Teal muy claro | `--surface-2` |
| `#1a4a52` | 10 | Teal oscuro | `--sidebar-bg` / `--primary` |
| `#ccfbf1` | 7 | Teal-100 Tailwind | acento suave |

**Azules genéricos** (no son el azul ZEIT `#003A8C`):

| Hex | Usos | → Token |
|---|---|---|
| `#1d4ed8` | 28 | `--primary` |
| `#1e40af` | 24 | `--primary` |
| `#2563eb` | 14 | `--primary` |
| `#3b82f6` | 12 | `--primary` (variante clara) |
| `#0369a1` | 9 | `--primary` / `--accent` |
| `#dbeafe`, `#eff6ff`, `#bfdbfe` | ~60 | Fondos azules → `--surface-2` con tinte primary |

**Naranjas genéricos** (no son `#FF6B00`): `#ea580c` (7), `#9a3412` (8) → `--action`.

### ⚪ GRISES GENÉRICOS — alinear a neutros ZEIT (prioridad MEDIA)

Son grises planos de Tailwind; los neutros ZEIT tienen un ligero tinte azul (más "de marca").

| Hex | Usos | → Token |
|---|---|---|
| `#e5e7eb` | 519 | `--border` (`#E2E8F0`) |
| `#9ca3af` | 462 | `--text-muted` |
| `#6b7280` | 325 | `--text-muted` |
| `#374151` | 278 | `--text` |
| `#f3f4f6` | 227 | `--surface-2` / `--bg` |
| `#f9fafb` | 170 | `--bg` |
| `#d1d5db` | 162 | `--border` |
| `#4b5563` | 142 | `--text` / `--text-muted` |
| `#111827`, `#1f2937` | ~123 | `--text` |
| `#fafafa` | 67 | `--bg` / `--surface` |

### 🟡 SEMÁNTICOS / ESTADOS — mantener (prioridad BAJA)

Son intencionalmente distintos (estados y badges). Varios **ya coinciden** con tus tokens.

- **Error (danger):** `#dc2626` ✅ (= `--danger`), `#ef4444`, `#fee2e2`, `#fef2f2`, `#991b1b`, `#fecaca`, `#fca5a5` → idealmente `var(--danger)` + sus fondos.
- **Éxito (success):** `#16a34a` ✅ (= `--success`), `#166534`, `#dcfce7`, `#22c55e`, `#15803d`, `#bbf7d0`, `#f0fdf4`, `#d1fae5`, `#065f46`, `#059669`, `#10b981`, `#86efac`.
- **Aviso (warning):** `#ca8a04` ✅ (= `--warning`), `#eab308` ✅, `#854d0e`, `#fef9c3`, `#d97706`, `#92400e`, `#fef3c7`, `#fde68a`, `#b45309`, `#fcd34d`.
- **Badges de rol:** morado `#7c3aed` / `#ede9fe` (admin), etc. → pueden quedarse fijos.

> Recomendación: los estados pueden mantenerse, pero referenciar `--success/--warning/--danger` da consistencia entre temas (claro/oscuro). Los badges de rol pueden quedar fijos a propósito.

---

## 4. Mapa por módulo (dónde está peor)

Casi todos los módulos están afectados. Pantallas con más colores a mano (peores ofensores por cantidad de hex):

| Pantalla | Hex a mano | Módulo |
|---|---|---|
| `admin/ReportingKPIs.jsx` | 147 | Admin / KPIs |
| `cotizaciones/PresupuestoView.jsx` | 130 | Cotizaciones |
| `operaciones/OTDetailView.jsx` | 125 | Operaciones |
| `admin/Requerimientos.jsx` | 113 | Admin |
| `HomeDashboard.jsx` | 107 | Inicio |
| `requests/AllRequests.jsx` | 99 | Solicitudes |
| `gerencia/AprobacionesGerencia.jsx` | 89 | Gerencia |
| `Materials.jsx` | 86 | Materiales |
| `operations/ProjectPlanView.jsx` | 85 | Operaciones |
| `admin/AdminProductividad.jsx` | 84 | Admin |
| `admin/AdminRoles.jsx` / `AdminUsers.jsx` | 76 / 75 | Admin |
| `canal/CanalView.jsx` | 74 | Canal |

**Familia teal:** 57 archivos (prácticamente toda la app).
**Azules genéricos:** 32 archivos.

---

## 5. Plan de migración recomendado (cuando decidas avanzar)

- **Fase 1 — Definir el mapeo canónico:** este documento (hecho).
- **Fase 2 — Alto impacto primero:** login, dashboards (Inicio/Admin/Logística/Operaciones), menú lateral. Es lo que más se ve.
- **Fase 3 — Módulo por módulo:** Cotizaciones → Logística → Operaciones → Admin → resto.
- **Método seguro:** reemplazar hex por `var(--token)` con criterio, **no** buscar/reemplazar a ciegas (los semánticos se quedan). Validar visualmente cada módulo.
- **Beneficio final:** todo el ERP responde a tus colores de marca, a los temas y a un futuro rebrand desde Admin → Branding sin tocar código.

## 6. Notas / riesgos

- No todos los hex son "malos": separar **marca** (migrar) de **semántico** (mantener).
- Es un trabajo grande (40+ archivos); por eso conviene fases y revisión visual.
- Algunos colores de gráficos (KPIs) pueden necesitar una paleta de datos propia, derivada de la marca.
