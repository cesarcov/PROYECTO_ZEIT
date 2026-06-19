# Metodología Spec-Driven Development (Spec Kit) — Guía de adopción

> **Para:** CeShark ERP Modular · **Autor:** Claude Code · **Fecha:** 2026-06-11
> **Objetivo:** dejar de programar por prueba-y-error y pasar a un flujo donde **primero definimos qué construir y cómo verificarlo, y solo entonces escribimos código**, con compuertas automáticas que impiden romper lo que ya funciona.

---

## 0. El problema que estamos resolviendo (diagnóstico honesto)

Hoy mismo pasó el síntoma exacto que quieres eliminar: arreglé **1 bug** en Reportes/KPIs y aparecieron **2 más en cadena** (`float(None)` → `oci.cantidad` → `dispatches`). Eso **no fue mala suerte**. La causa raíz es estructural:

| Causa raíz (hoy) | Consecuencia | Lo que Spec Kit / SDD aporta |
|---|---|---|
| **0 tests automáticos** (`tests/` está vacío) | Nadie avisa cuando un cambio rompe otra cosa | Compuerta de verificación obligatoria antes de "terminado" |
| **Sin especificación** del comportamiento esperado | "Terminado" es subjetivo; se descubre en producción | `spec.md` con criterios de aceptación medibles |
| **Sin reglas escritas** del proyecto | Cada cambio reinventa convenciones → código basura | `constitution.md`: principios no negociables |
| **Verificación manual** ("a ojo") | Lento y se escapan regresiones | `/speckit-analyze` + smoke tests automatizados |
| **Nombres de tablas/columnas a memoria** | Bugs como `dispatches` vs `stock_dispatches` | Regla de constitución: verificar contra el esquema real |

**Conclusión:** Spec Kit sin una **red de tests** no basta. Vamos a adoptar **ambos**: el flujo SDD (para pensar antes de codear) **+** una red mínima de smoke tests (para que romper algo se detecte en segundos, no en producción).

---

## 1. Qué es Spec-Driven Development (SDD) y Spec Kit

**SDD** invierte el orden tradicional. En vez de *"código primero, documentación después"*, la **especificación es la fuente de verdad** y de ella se derivan el plan, las tareas y el código.

**Spec Kit** es el toolkit open-source de GitHub que implementa SDD con una CLI (`specify`) y comandos de barra (`/speckit-*`) que tu agente (Claude Code) ejecuta. El flujo oficial, en orden:

| Fase | Comando | Produce | Foco |
|---|---|---|---|
| 1. Constitución | `/speckit-constitution` | `.specify/memory/constitution.md` | Principios y reglas no negociables del proyecto |
| 2. Especificar | `/speckit-specify` | `specs/NNN-feature/spec.md` | **QUÉ** y **POR QUÉ** (historias de usuario, requisitos) — *sin* tecnología |
| 3. Clarificar | `/speckit-clarify` | actualiza `spec.md` | Preguntas para eliminar ambigüedad **antes** de planear |
| 4. Planear | `/speckit-plan` | `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md` | **CÓMO**: stack, arquitectura, contratos de API |
| 5. Tareas | `/speckit-tasks` | `tasks.md` | Lista ordenada, con dependencias y marcadores de paralelización + estructura de tests |
| 6. Analizar | `/speckit-analyze` | reporte de consistencia | Cruza spec↔plan↔tareas para detectar huecos **antes** de codear |
| 7. Implementar | `/speckit-implement` | el código | Ejecuta las tareas siguiendo el plan |
| 8. Converger | `/speckit-converge` | nuevas tareas | Evalúa el código real vs spec/plan y agrega lo que falta |
| (opcional) | `/speckit-checklist` | checklist de calidad | Listas de verificación a medida |

> Nota (verificado tras instalar): en la versión actual los comandos son **skills con guion** — `/speckit-constitution`, `/speckit-specify`, `/speckit-plan`, `/speckit-tasks`, `/speckit-analyze`, `/speckit-implement`, `/speckit-converge` — y viven en **`.claude/skills/`**. **Solo aparecen si abres Claude Code con `erp-modular/` como carpeta raíz** (no la carpeta padre `ERP_MODULO`).

---

## 2. Diagnóstico de TU proyecto (estado real, 2026-06-11)

| Prerequisito / hecho | Estado | Acción |
|---|---|---|
| Git | ✅ Instalado (2.52) y **`erp-modular/` ES un repo git** | Spec Kit se inicializa **dentro de `erp-modular/`** |
| Carpeta padre `ERP_MODULO/` | ⚠️ **No** es repo git | Trabajaremos con `erp-modular/` como raíz del proyecto |
| Python 3.11+ | ✅ 3.11.9 | OK |
| Node / npm | ✅ v24 / 11 | OK |
| **uv** (instalador de la CLI) | ❌ **No instalado** | Instalarlo (paso de setup) |
| **Tests de la app** | ❌ `tests/` vacío | Crear red de smoke tests (paso de setup) |
| CI/CD | ❌ No hay | Opcional fase 2 (GitHub Actions) |
| Spec Kit | ❌ No inicializado (`.claude/skills` no existe) | `specify init` (paso de setup) |

**Implicación clave: somos un proyecto _Brownfield_** (código ya avanzado: ~28 migraciones, 10+ módulos backend, ~50 vistas React). Spec Kit lo soporta como **"Iterative Enhancement"**. **No vamos a re-especificar todo el código existente.** La estrategia es la sección 3.

---

## 3. Estrategia de adaptación Brownfield (cómo encaja en código ya avanzado)

No empezamos de cero, así que aplicamos SDD en 4 capas, de menor a mayor esfuerzo:

1. **Constitución primero (1 sola vez).** Codificamos las convenciones que YA usa el proyecto + las lecciones aprendidas (incluidas las de hoy). Esto es lo más valioso y barato: a partir de aquí, todo código nuevo respeta las mismas reglas. → sección 9.
2. **Red de seguridad mínima (1 sola vez).** Smoke tests que recorren los endpoints críticos + `npm run build`. Es **la compuerta antirregresión**. → sección 6.
3. **De aquí en adelante, todo pasa por el pipeline.** Cada *feature nueva* o *lote de bugs* se hace con `specify → clarify → plan → tasks → analyze → implement`. → sección 5.
4. **Retro-spec incremental (opcional, solo módulos críticos).** Cuando toquemos un módulo existente importante (ej. Planificación), escribimos su `spec.md` "tal como debe comportarse" usando `/speckit-converge`. No se hace de golpe; se hace cuando lo tocamos.

---

## 4. Setup (prerequisitos + comandos exactos) — **requiere tu OK**

> ⚠️ Esto **modifica tu proyecto** (crea carpetas `.specify/`, `.claude/skills/`, `specs/`) e instala una herramienta (`uv`). Por eso **no lo ejecuto sin tu visto bueno**. Cuando digas "dale", corro estos pasos y te muestro cada resultado.

**Paso 4.1 — Instalar `uv`** (gestor de paquetes Python de Astral):
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**Paso 4.2 — Inicializar Spec Kit dentro del repo (`erp-modular/`):**
```powershell
# desde d:\PROYECTOS\ERP_MODULO\erp-modular
uvx --from git+https://github.com/github/spec-kit.git specify init . --here --integration claude
```
- `--here` / `.` → inicializa en el directorio actual (no crea subcarpeta).
- `--integration claude` → genera los comandos para **Claude Code** en `.claude/skills/`. (Si el nombre exacto del agente difiere, lo confirmo con `specify integration list` y uso el correcto.)
- Si la carpeta no está vacía y se queja, se usa `--force`.

**Paso 4.3 — Verificar estructura creada:**
```
erp-modular/
├── .specify/
│   ├── memory/constitution.md      ← las reglas del proyecto
│   ├── scripts/                    ← scripts de soporte
│   └── templates/                  ← plantillas de spec/plan/tasks
├── .claude/skills/               ← los comandos /speckit-* para Claude Code
└── specs/                          ← aquí vive cada feature (NNN-nombre/)
```

> **Importante sobre Claude Code:** para que los comandos `/speckit-*` aparezcan, esta sesión debe tener `erp-modular/` como carpeta de trabajo. Hoy la raíz es la carpeta padre. Lo ajustamos al hacer el setup (o abrís Claude Code apuntando a `erp-modular/`).

---

## 5. El flujo por feature — con **compuertas (tú decides)** y **loops (yo trabajo)**

Cada vez que quieras algo nuevo (o arreglar un lote de bugs), seguimos este ciclo. Marco con 🧑 donde **necesito tu instrucción/aprobación** y con 🔁 donde **yo ejecuto en loop**.

```
  TU IDEA EN UNA FRASE
        │
        ▼
  /speckit-specify  ──►  spec.md (QUÉ/POR QUÉ)
        │
        ▼
  /speckit-clarify  ──►  🧑 GATE 1: respondes preguntas de ambigüedad
        │
        ▼
  /speckit-plan     ──►  plan.md (CÓMO) ──► 🧑 GATE 2: apruebas el enfoque técnico
        │
        ▼
  /speckit-tasks    ──►  tasks.md (lista ordenada, test-first)
        │
        ▼
  /speckit-analyze  ──►  🧑 GATE 3: revisas el reporte de consistencia
        │
        ▼
  /speckit-implement ─► 🔁 LOOP A (por cada tarea: codear → verificar → arreglar → verde)
        │
        ▼
  COMPUERTA FINAL: smoke tests + build VERDES ──► 🧑 GATE 4: aceptación
        │
        ▼
  commit (rama de la feature) → done
```

### Los 3 loops (donde sigo desarrollando solo)

- **🔁 Loop A — Implementación por tarea (el principal):**
  `tomar tarea → escribir código → correr la compuerta de verificación → ¿roja? arreglar → repetir hasta verde → marcar tarea hecha → siguiente`.
  Aquí trabajo autónomo, pero **ninguna tarea se cierra con la compuerta en rojo.**

- **🔁 Loop B — Bugfix (reproduce-primero):**
  `escribir un test que reproduce el bug (rojo) → arreglar → ese test pasa (verde) → correr TODA la suite para confirmar que no rompí nada más`.
  Esto es exactamente lo que hoy faltó: hoy descubrí los bugs encadenados a mano; con esto, el segundo y tercer bug habrían saltado solos.

- **🔁 Loop C — Desatendido (opcional):** si querés que avance una lista larga de tareas sin supervisión, uso el skill `/loop` de Claude Code para iterar el Loop A automáticamente y te aviso al terminar o si me topo con una decisión 🧑.

---

## 6. La compuerta de verificación (lo que IMPIDE romper otras cosas)

Esta es la pieza que más te va a servir. Definimos **un solo comando** que corre todo y que **debe estar verde** para cerrar cualquier tarea:

**Backend — smoke tests (pytest):** un archivo `tests/smoke/test_endpoints.py` que:
1. Hace login real (ej. `juliet_alvis`) y obtiene token.
2. Golpea los endpoints críticos de cada módulo esperando `200` + forma correcta:
   - `/reporting/requests/kpis/dashboard-kpis` (las 5 áreas)
   - `/admin/audit-logs` + `/admin/audit-logs/export`
   - `/planificacion/actividades` + `/actividades/export`
   - …(se amplía a medida que crece el ERP)
3. Verifica que `from app.main import app` importa sin error.

**Frontend — build:** `npm run build` (atrapa errores de sintaxis/imports, como hicimos hoy).

**Wrapper único** `verify.ps1` (lo creamos en el setup):
```powershell
# 1) backend importa + 2) smoke tests + 3) build frontend
venv\Scripts\python -c "import app.main"        ; if(-not $?){exit 1}
venv\Scripts\python -m pytest tests/smoke -q    ; if(-not $?){exit 1}
npm --prefix frontend/myapp run build           ; if(-not $?){exit 1}
Write-Host "✅ TODO VERDE"
```

**Regla de oro (irá en la constitución):** *ninguna tarea se marca "terminada" sin `verify.ps1` en verde.*

> Esto no necesita Spec Kit para existir — pero es el complemento que convierte SDD en una verdadera red anti-regresión.

---

## 7. Cómo trabajamos tú y yo (roles claros)

| Fase | Quién actúa | Tu rol (🧑) | Mi rol (🔁/⚙️) |
|---|---|---|---|
| Constitución | Juntos 1 vez | Apruebas/ajustas los principios | Redacto el borrador (sección 9) |
| `specify` | Yo, con tu frase | Das la idea en lenguaje natural | Genero `spec.md` |
| `clarify` | Tú | **Respondes preguntas** (GATE 1) | Hago las preguntas correctas |
| `plan` | Yo | Apruebas el enfoque (GATE 2) | Genero `plan.md` + contratos |
| `tasks` | Yo | (revisión opcional) | Genero `tasks.md` |
| `analyze` | Yo | Revisas huecos (GATE 3) | Reporte de consistencia |
| `implement` | Yo | Disponible para dudas | 🔁 Loop A con compuerta |
| Aceptación | Tú | **Aceptas** (GATE 4) | Demuestro verde + commit |

**Resumen de dónde me das instrucciones:** (1) la idea inicial, (2) responder `clarify`, (3) aprobar el `plan`, (4) revisar `analyze`, (5) aceptar el resultado. En todo lo demás, yo ejecuto en loop con la compuerta.

---

## 8. Primer piloto sugerido (para aprender el flujo con algo real)

Propongo correr el pipeline **completo** sobre algo acotado y ya conocido, como demostración end-to-end. Candidatos:

- **A) Bugfix con red de tests:** tomar uno de los pendientes (ej. *export de Planificación sin filtro por responsable*) y hacerlo con el **Loop B** (test que reproduce → arreglo → verde). Enseña la mecánica antirregresión.
- **B) Feature chica:** *convertir los modales restantes (export ×3 + cancelación) a paneles en línea* vía `specify → plan → tasks → implement`. Enseña el pipeline completo.
- **C) Retro-spec:** escribir el `spec.md` de **Planificación** (módulo crítico) para blindar su comportamiento antes de seguir tocándolo.

Mi recomendación: **A primero** (rápido, instala la cultura de "test que reproduce"), luego **B**.

---

## 9. Constitución inicial propuesta (borrador — lo refinamos juntos)

Estos serían los **artículos no negociables** de `.specify/memory/constitution.md`. Incluyo las lecciones de hoy:

1. **Verificación obligatoria.** Ninguna tarea se cierra sin `verify.ps1` en verde (import backend + smoke tests + build frontend).
2. **Bugfix reproduce-primero.** Todo bug se arregla escribiendo antes un test que lo reproduce.
3. **Esquema real, no de memoria.** Antes de escribir SQL, verificar nombres de tabla/columna contra el esquema (`information_schema`). *(Lección: `dispatches`→`stock_dispatches`, `cantidad`→`cantidad_pedida`.)*
4. **Nulos defensivos.** Toda agregación SQL que pueda ser `NULL` se castea con guarda (`_f()` / `COALESCE`). *(Lección: `float(None)`.)*
5. **Errores visibles, nunca silenciosos.** Nada de `except: pass`; el frontend muestra estado de error, no pantalla en blanco.
6. **Contratos estables.** Backend y frontend acuerdan la forma del JSON en `contracts/`; cambiarla obliga a actualizar la spec.
7. **Permisos y rol primero.** Toda ruta nueva declara su permiso y se prueba con el rol real (ej. Juliet = Administrador General).
8. **Convenciones del repo.** Endpoints `/export` y `/import` antes de `/{id}`; `formatUsername()` en UI; paleta CeShark; `127.0.0.1` (no `localhost`).
9. **Una feature = una rama git.** Cada `specs/NNN-*` vive en su rama; se mergea con la compuerta verde.
10. **Colaboración con Antigravity** según `COLLABORATION.md` se mantiene; la spec es la fuente de verdad compartida.

---

## 10. Checklist de arranque (qué hacemos cuando digas "dale")

- [ ] **4.1** Instalar `uv`.
- [ ] **4.2** `specify init . --here --integration claude` dentro de `erp-modular/`.
- [ ] **4.3** Verificar estructura `.specify/`, `.claude/skills/`, `specs/`.
- [ ] **9** Ejecutar `/speckit-constitution` con el borrador de la sección 9 → revisás y apruebas.
- [ ] **6** Crear `tests/smoke/` + `verify.ps1` y dejarlo en **verde** con el código actual.
- [ ] **8** Elegir piloto (A/B/C) y correr el pipeline completo como demostración.

---

### Resumen en una línea
> **Constitución (reglas) + Specs (qué) + Compuerta de verificación (no romper) + Loops (yo ejecuto, tú apruebas en 4 puntos).** Eso convierte el "prueba y error" en un proceso predecible.
