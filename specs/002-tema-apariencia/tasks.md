---
description: "Task list — Sistema de temas (motor + armazón, tramo 002a)"
---

# Tasks: Sistema de temas (apariencia) — motor + armazón

**Input**: Design documents from `specs/002-tema-apariencia/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUIDOS — el Artículo 5 de la constitución exige un smoke test para el endpoint nuevo de preferencias. Se escribe antes de la implementación (debe fallar primero).

**Organization**: Tareas agrupadas por historia de usuario. Alcance = motor de temas + armazón (Layout, Login, footer, Preferencias, logo). Las ~70 vistas de módulo se migran en tramos siguientes.

## Format: `[ID] [P?] [Story] Descripción con ruta de archivo`

- **[P]**: puede correr en paralelo (archivo distinto, sin dependencias pendientes)
- **[Story]**: a qué historia pertenece (US1/US2/US3)

---

## Phase 1: Setup

- [X] T001 Confirmar rama `002-tema-apariencia` activa y correr `.\verify.ps1` para registrar el baseline verde antes de tocar nada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el motor de temas que todas las historias necesitan.

**⚠️ CRITICAL**: ninguna historia puede completarse hasta terminar esta fase.

- [X] T002 Crear `frontend/myapp/src/theme/themes.css` con los **5 token sets** como bloques `[data-theme="zeit-claro|zeit-oscuro|zeit-oscuro-energia|zeit-turquesa|zeit-grafito"]`, usando exactamente los valores de `data-model.md` (todos los tokens del contrato `theme-tokens.md`). Importarlo en `frontend/myapp/src/index.css`.
- [X] T003 [P] Crear `frontend/myapp/src/theme/ThemeProvider.jsx`: contexto `useTheme()` que expone `{ tema, setTema, temaEfectivo }`, resuelve `"system"` con `matchMedia('(prefers-color-scheme: dark)')`, aplica `document.documentElement.dataset.theme`, y cachea en `localStorage["zeit_tema"]`. (Persistencia en cuenta se añade en US2.)
- [X] T004 Envolver la app con `ThemeProvider` en `frontend/myapp/src/main.jsx` y añadir un script anti-parpadeo que lea `localStorage["zeit_tema"]` y fije `data-theme` ANTES del primer render.

**Checkpoint**: el motor aplica temas; falta exponerlo en UI y persistir en cuenta.

---

## Phase 3: User Story 1 - Elegir tema y verlo al instante (Priority: P1) 🎯 MVP

**Goal**: el usuario elige entre los 5 temas (o "seguir el sistema") y el armazón cambia al instante.

**Independent Test**: en Preferencias → Apariencia, alternar temas y ver sidebar/header/footer cambiar sin recargar.

### Implementation

- [X] T005 [US1] En `frontend/myapp/src/pages/Preferences.jsx`, agregar una sección "Apariencia" con un selector de los 5 temas + opción "Seguir el sistema", conectado a `useTheme()` (cambia el tema al instante).
- [X] T006 [P] [US1] Migrar los colores del armazón en `frontend/myapp/src/components/Layout.jsx` (barra lateral, encabezado, footer) de hex literal a `var(--token)`.
- [X] T007 [P] [US1] Migrar `frontend/myapp/src/pages/Login.jsx` de hex literal a `var(--token)`.

**Checkpoint**: US1 funcional — cambio de tema visible en el armazón. MVP (recordado por navegador vía localStorage).

---

## Phase 4: User Story 2 - Recordar el tema en mi cuenta (Priority: P1)

**Goal**: la preferencia se guarda en la cuenta y se restaura en cualquier dispositivo.

**Independent Test**: elegir tema, cerrar sesión, volver a entrar (incluso en otro navegador) y ver el mismo tema.

### Tests (escribir primero, debe fallar)

- [X] T008 [US2] Smoke test en `tests/smoke/test_endpoints.py`: `PUT /auth/me/preferences {"tema":"zeit-oscuro"}` responde 200 y un `GET /auth/me/preferences` posterior devuelve `tema = "zeit-oscuro"`.

### Implementation

- [X] T009 [US2] Crear `migrations/034_user_preferencias.sql`: `ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'`. Aplicar con `run_migrations.py`.
- [X] T010 [US2] En el `service.py` del módulo auth, agregar funciones para **leer** y **actualizar (merge)** `users.preferencias` del usuario actual (SQL crudo, guarda de nulos: si es NULL/sin `tema` → `system`; validar `tema` contra la lista permitida).
- [X] T011 [US2] En el `router.py` del módulo auth, agregar `GET /auth/me/preferences` y `PUT /auth/me/preferences` (dependencia `get_current_user`), delegando al service. **Solo-auth**: es dato propio del usuario, mismo patrón que los endpoints `/my` ya existentes (no requiere `require_permission`). Declarar las rutas literales antes de cualquier `/{id}`.
- [X] T012 [US2] En `ThemeProvider.jsx`, al iniciar sesión leer el tema desde `GET /auth/me/preferences` (reconciliando con el caché localStorage) y, al cambiar de tema, persistir con `PUT /auth/me/preferences`.

**Checkpoint**: US1 + US2 — el tema se recuerda en la cuenta.

---

## Phase 5: User Story 3 - Identidad visual ZEIT Solutions (Priority: P2)

**Goal**: marca ZEIT principal + crédito "Powered by CeShark · ERP Engine", con los colores corporativos.

**Independent Test**: revisar login y footer; ver logo/nombre ZEIT como principal y CeShark discreto, en cualquier tema.

### Implementation

- [X] T013 [US3] Crear `frontend/myapp/src/components/ZeitLogo.jsx` (reemplaza el uso de `CeSharkLogo`) que renderiza el logo ZEIT (globo+onda). Colocar el asset en `frontend/myapp/src/assets/zeit-logo.png` (provisto por ZEIT); si aún no está, usar un SVG placeholder coherente con la marca.
- [X] T014 [US3] En `Login.jsx` y `Layout.jsx`, usar `ZeitLogo` y el nombre "ZEIT SOLUTIONS" como marca principal, y mostrar "Powered by CeShark · ERP Engine" en segundo plano (login y footer de la barra lateral). (Depende de T006/T007 — mismos archivos.)

**Checkpoint**: las tres historias completas en el armazón.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T015 Ejecutar manualmente los escenarios E1–E6 de `specs/002-tema-apariencia/quickstart.md` (incluye anti-parpadeo, seguir el sistema, y que las vistas no migradas sigan usables) **y verificar el contraste de texto (WCAG AA ≥ 4.5:1) en los 5 temas** (SC-003/FR-006). **← Validación de aceptación (GATE 4).**
- [X] T016 Correr `.\verify.ps1` y confirmar **TODO VERDE** (compuerta obligatoria antes de cerrar).
- [X] T017 [P] Actualizar `docs/ESTADO_ACTUAL.md` anotando el motor de temas (tramo 002a) y la migración de vistas pendiente por tramos.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias.
- **Foundational (T002–T004)**: tras Setup. **Bloquea** las historias.
- **US1 (T005–T007)**: tras Foundational. Es el MVP (recuerda por navegador).
- **US2 (T008–T012)**: tras Foundational. T012 depende de T010/T011 (endpoint). T008 (test) primero, en rojo.
- **US3 (T013–T014)**: tras Foundational. T014 toca `Login.jsx`/`Layout.jsx` → va **después** de T006/T007 (mismos archivos).
- **Polish (T015–T017)**: tras las historias.

### Parallel Opportunities

- T003 [P] (ThemeProvider) en paralelo con T002 (themes.css).
- T006 [P] (Layout) y T007 [P] (Login) en paralelo entre sí (archivos distintos).
- T017 [P] al final.

---

## Implementation Strategy

### MVP First (US1)
1. T001 baseline.
2. T002–T004 (motor de temas).
3. T005–T007 (selector + armazón temable).
4. **PARAR y VALIDAR**: cambiar de tema y verlo al instante (recordado por navegador).

### Incremental
- US1 (instantáneo) → US2 (recordar en cuenta) → US3 (marca ZEIT) → Polish.
- Tras este tramo: features siguientes migran las ~70 vistas de módulo a tokens.

---

## Notes

- `[P]` = archivos distintos, sin dependencias pendientes.
- Verificar que el smoke test (T008) falle antes de implementar el endpoint.
- Regla transversal (FR-010): el naranja nunca en `--bg`/`--surface`/`--primary`/`--sidebar-bg`; solo `--action`/`--accent`/`--sidebar-active`.
- Las vistas de módulo NO migradas deben seguir usables (no rotas) en cualquier tema.
- Commit tras cada historia, siempre con la compuerta en verde.

## Total

**17 tareas** · Setup 1 · Foundational 3 · US1 3 · US2 5 · US3 2 · Polish 3.
