---
description: "Task list — Marca configurable (white-label)"
---

# Tasks: Marca configurable (white-label)

**Input**: Design documents from `specs/003-marca-configurable/`

**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: INCLUIDOS — el Artículo 5 de la constitución exige smoke tests para los endpoints nuevos. Se escriben antes de implementar.

**Organization**: Tareas agrupadas por historia de usuario (US1..US5). Backend (router/service de `branding`) y la página `AdminBranding.jsx` se tocan en varias historias → esas tareas van secuenciales.

## Format: `[ID] [P?] [Story] Descripción con ruta de archivo`

- **[P]**: archivo distinto, sin dependencias pendientes.

---

## Phase 1: Setup

- [ ] T001 Confirmar rama `003-marca-configurable` y correr `.\verify.ps1` para registrar el baseline verde.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: el camino de **lectura** de la marca (servidor → frontend) que todas las historias necesitan.

**⚠️ CRITICAL**: ninguna historia puede completarse hasta terminar esta fase.

- [ ] T002 Crear `migrations/035_branding.sql` (tabla singleton `branding` con campos nullable + `logo_incluye_nombre BOOLEAN DEFAULT TRUE` + fila `id=1`, idempotente) y aplicarla con `python run_migrations.py`.
- [ ] T003 [P] Crear el módulo `app/modules/branding/` (`__init__.py`, `schemas.py`, `service.py`, `router.py`): `service.get_branding()` lee la fila singleton (SQL, guarda de nulos) y arma la respuesta con defaults ZEIT; `GET /branding` **público** (sin auth) devuelve esa forma (ver `contracts/branding-api.md`).
- [ ] T004 En `app/main.py`: `app.include_router(branding_router)` y montar `StaticFiles` en `/branding-assets` apuntando a `app/storage/branding/` (crear la carpeta si falta).
- [ ] T005 Frontend: en `frontend/myapp/src/branding/brand.js` resolver la marca desde `GET /branding` al arrancar (merge con defaults ZEIT + caché localStorage); en `main.jsx` aplicar `document.title` y favicon; en `theme/ThemeProvider.jsx` aplicar los colores corporativos como variables CSS (`--primary/--accent/--action`) sobre `document.documentElement`; y en `components/ZeitLogo.jsx`, cuando `logoIncluyeNombre` es false (o no hay logo), mostrar `appName` como texto en vez de las `nameParts` fijas "ZEIT".

**Checkpoint**: la app lee la marca del servidor (vacía → ZEIT por defecto) y la aplica; falta el panel de edición.

---

## Phase 3: User Story 1 - Nombre y eslogan (Priority: P1) 🎯 MVP

**Goal**: el admin cambia nombre y eslogan y se ven en toda la app.

**Independent Test**: cambiar el nombre a "ACME ERP", guardar, y verlo en login, sidebar y título de pestaña.

- [ ] T006 [US1] Smoke test en `tests/smoke/test_endpoints.py`: `PUT /branding {"nombre_producto":"ACME"}` como admin → 200 y `GET /branding` lo refleja.
- [ ] T007 [US1] Backend: `PUT /branding` (admin, `require_permission("admin:users")`) en `branding/router.py` + `service.update_branding()` (actualiza `nombre_producto`, `eslogan`, `logo_incluye_nombre`; SQL en service).
- [ ] T008 [US1] Frontend: crear `frontend/myapp/src/pages/admin/AdminBranding.jsx` con campos nombre + eslogan + casilla "Mi logo ya incluye el nombre" y guardar (PUT); registrar la ruta `/admin/branding` en `App.jsx` y el ítem "Marca" en el menú Admin de `Layout.jsx`.

**Checkpoint**: US1 funcional — rebrand de nombre/eslogan desde el panel.

---

## Phase 4: User Story 2 - Subir logos claro/oscuro (Priority: P1)

**Goal**: el admin sube logos y aparecen en todas las pantallas, eligiendo variante según el fondo.

**Independent Test**: subir logo claro y oscuro; verificar que el login (oscuro) usa el oscuro y una superficie clara usa el claro.

- [ ] T009 [US2] Smoke test en `tests/smoke/test_endpoints.py`: `POST /branding/logo?variant=claro` (admin, multipart con PNG válido) → 200; archivo no-imagen o > 2 MB → 422.
- [ ] T010 [US2] Backend: `POST /branding/logo` (admin) en `branding/router.py` + service: validar formato (PNG/JPG con Pillow, o SVG por contenido) y tamaño ≤ 2 MB, guardar en `app/storage/branding/` y actualizar la ruta en la tabla.
- [ ] T011 [US2] Frontend: en `AdminBranding.jsx`, controles de subida para logo claro / oscuro / isotipo / favicon (POST) con vista previa.

**Checkpoint**: US1 + US2 — logo y nombre personalizables.

---

## Phase 5: User Story 5 - Colores corporativos (Priority: P2)

**Goal**: el admin define primario/acento/acción y se aplican en los 5 temas.

**Independent Test**: cambiar primario y acento; ver botones/navegación activa con esos colores en cualquier tema, con texto legible.

- [ ] T012 [US5] Backend: extender `PUT /branding` y `service.update_branding()` para aceptar y **validar** `color_primario`, `color_acento`, `color_accion` (color válido → si no, 422 conservando lo anterior) en `branding/service.py`.
- [ ] T013 [US5] Frontend: en `AdminBranding.jsx`, selectores de color (primario/acento/acción) que guardan (PUT); confirmar que `ThemeProvider` (T005) los aplica como variables CSS en todos los temas.

**Checkpoint**: la paleta corporativa de la empresa se aplica al ERP.

---

## Phase 6: User Story 3 - Restablecer a ZEIT (Priority: P2)

**Goal**: quitar la marca personalizada y volver al default.

**Independent Test**: con marca personalizada, "Restablecer" y ver que vuelve ZEIT sin pantallas rotas.

- [ ] T014 [US3] Smoke test en `tests/smoke/test_endpoints.py`: `DELETE /branding` (admin) → 200 y `GET /branding` devuelve los defaults (campos en null).
- [ ] T015 [US3] Backend: `DELETE /branding` (admin) en `branding/router.py` + service: limpiar campos a NULL y borrar los archivos subidos de `app/storage/branding/`.
- [ ] T016 [US3] Frontend: en `AdminBranding.jsx`, botón "Restablecer marca" con confirmación (DELETE).

**Checkpoint**: reversibilidad garantizada.

---

## Phase 7: User Story 4 - Marca solo-lectura para los demás (Priority: P2)

**Goal**: solo el admin edita; los demás solo ven.

**Independent Test**: como usuario no-admin, no hay acceso a editar; un PUT directo es rechazado.

- [ ] T017 [US4] Smoke test en `tests/smoke/test_endpoints.py`: `PUT /branding` sin token → 401/403; (los endpoints de escritura ya exigen `admin:users` en T007/T010/T015).
- [ ] T018 [US4] Frontend: ocultar la ruta/ítem "Marca" para usuarios sin rol admin (usar `ProtectedRoute`/`can()` en `App.jsx` y `Layout.jsx`).

**Checkpoint**: las 5 historias completas.

---

## Phase 8: Polish & Cross-Cutting

- [ ] T019 Ejecutar manualmente los escenarios E1–E7 de `specs/003-marca-configurable/quickstart.md` (incluye crédito CeShark fijo y contraste con colores personalizados). **← Validación de aceptación (GATE 4).**
- [ ] T020 Correr `.\verify.ps1` y confirmar **TODO VERDE** (compuerta obligatoria antes de cerrar).
- [ ] T021 [P] Actualizar `docs/ESTADO_ACTUAL.md` anotando la marca configurable (white-label) y la tabla `branding`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: sin dependencias.
- **Foundational (T002–T005)**: tras Setup. **Bloquea** las historias. Orden interno: T002 (migración) → T003 (módulo + GET) → T004 (main.py) ; T005 (frontend) depende de que GET exista.
- **US1 (T006–T008)**, **US2 (T009–T011)**, **US5 (T012–T013)**, **US3 (T014–T016)**, **US4 (T017–T018)**: tras Foundational.
- **Polish (T019–T021)**: tras las historias.

### Archivos compartidos (van secuenciales)

- `app/modules/branding/router.py` y `service.py`: T003, T007, T010, T012, T015.
- `frontend/.../pages/admin/AdminBranding.jsx`: T008, T011, T013, T016.

### Parallel Opportunities

- T003 [P] (backend módulo) en paralelo con tareas de otros archivos.
- Los smoke tests (T006/T009/T014/T017) son del mismo archivo de tests → secuenciales entre sí, pero independientes del frontend.
- T021 [P] al final.

---

## Implementation Strategy

### MVP First
1. T001 baseline → T002–T005 (camino de lectura) → **US1** (T006–T008: nombre/eslogan) → **US2** (T009–T011: logos).
2. Con US1+US2 ya se puede rebrandear nombre + logo para otra empresa (MVP del white-label).

### Incremental
- US1 (nombre/eslogan) → US2 (logos) → US5 (colores) → US3 (restablecer) → US4 (control de acceso) → Polish.

---

## Notes

- `GET /branding` es público (lo usa el login); las escrituras exigen `admin:users`.
- Imágenes validadas (PNG/SVG/JPG ≤ 2 MB) y servidas vía `<img>` (SVG sin ejecución de scripts).
- El crédito "Powered by CeShark" es FIJO (no se toca).
- Sin marca → defaults ZEIT (feature 002); cero regresión.
- Commit por historia, siempre con la compuerta en verde.

## Total

**21 tareas** · Setup 1 · Foundational 4 · US1 3 · US2 3 · US5 2 · US3 3 · US4 2 · Polish 3.
