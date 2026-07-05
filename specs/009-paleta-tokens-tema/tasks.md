# Tasks: Sistema de Paleta Corporativa y Tokens de Tema

**Input**: Design documents from `specs/009-paleta-tokens-tema/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/branding-api.md

**Organization**: Tareas agrupadas por user story. Cada fase es un incremento independiente y verificable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Puede ejecutarse en paralelo con otras tareas del mismo nivel
- **[Story]**: A que user story pertenece la tarea (US1, US2, US3, US4)
- Cada tarea incluye el path exacto del archivo a modificar

---

## Phase 1: Setup (Infraestructura compartida)

**Purpose**: Migracion de base de datos que desbloquea todo el trabajo de backend.

- [X] T001 Crear y aplicar migracion `migrations/043_branding_color_texto_secundario.sql` con `ALTER TABLE branding ADD COLUMN IF NOT EXISTS color_texto_secundario VARCHAR(7)`, luego ejecutar `python run_migrations.py`

**Checkpoint**: La columna existe en DB. Verificar con `\d branding` en psql.

---

## Phase 2: Foundational (Prerrequisitos bloqueantes)

**Purpose**: Actualizaciones de backend y CSS base que desbloquean todas las user stories.

**CRITICO**: Ninguna user story puede completarse hasta que esta fase este lista.

- [X] T002 [P] Actualizar `app/modules/branding/schemas.py`: agregar `color_texto_secundario: Optional[str] = None` a la clase `BrandingUpdate`
- [X] T003 [P] Actualizar `app/modules/branding/service.py`: (1) agregar `"color_texto_secundario"` a la lista `_COLS` aprox. linea 30; (2) en `get_branding_public()` agregar `"textSecondary": b.get("color_texto_secundario")` dentro del dict `colors`; (3) en `update_branding()` incluir `"color_texto_secundario"` en el loop de validacion hex y en la tupla `editable`
- [X] T004 Actualizar `frontend/myapp/src/theme/themes.css`: (1) eliminar completamente los bloques `[data-theme="zeit-oscuro-energia"]`, `[data-theme="zeit-turquesa"]` y `[data-theme="zeit-grafito"]`; (2) en `[data-theme="zeit-oscuro"]` cambiar los valores a: `--bg:#001F54`, `--surface:#0D2545`, `--surface-2:#163770`, `--text:#E8EEF9`, `--text-muted:#9AAFC5`, `--border:#1E3F70`, `--primary:#4A8CE8`, `--sidebar-bg:#001240`

**Checkpoint**: `python -c "import app.main"` sin errores. El archivo `themes.css` queda con exactamente 2 bloques de tema (`zeit-claro` y `zeit-oscuro`).

---

## Phase 3: User Story 1 y 3 - Tema visual equilibrado con contraste correcto (Priority: P1/P2) MVP

**Goal**: El usuario puede alternar entre exactamente 2 temas (Claro / Oscuro), ambos con contraste WCAG AA garantizado y look sobrio — el oscuro usa Azul Navy #001F54, el claro mantiene su gris-azul suave #F4F6FA.

**Independent Test**: Abrir la app, ir a Preferencias, verificar que el selector muestra solo "Claro" y "Oscuro". Cambiar a Oscuro y navegar a cualquier modulo — el fondo debe ser azul navy (no negro), el texto near-white legible.

- [X] T005 [US1] [US3] Actualizar `frontend/myapp/src/theme/ThemeProvider.jsx`: (1) reducir el array `TEMAS` a exactamente 2 entradas: `{ id: "zeit-claro", label: "Claro" }` y `{ id: "zeit-oscuro", label: "Oscuro" }`; (2) eliminar el caso `"system"` en la funcion `resolverEfectivo()` — el nuevo fallback es `"zeit-claro"`; (3) en `useState` inicial, si el valor guardado en localStorage no esta en los 2 validos, usar `"zeit-claro"` como default
- [X] T006 [US1] [US3] Agregar en `frontend/myapp/src/theme/ThemeProvider.jsx` la funcion `inyectarTokensBranding(colors)` que recibe el objeto `colors` de `/branding` y ejecuta `document.documentElement.style.setProperty("--primary", colors.primary ?? "")`, `setProperty("--accent", colors.accent ?? "")`, `setProperty("--action", colors.action ?? "")`, `setProperty("--text-muted", colors.textSecondary ?? "")` para los 4 tokens; limpiar el setProperty si el valor es null (para que `themes.css` tome el default)
- [X] T007 [US1] [US3] Integrar la llamada a `inyectarTokensBranding` en `frontend/myapp/src/theme/ThemeProvider.jsx` o en `frontend/myapp/src/components/Layout.jsx`: despues de que el componente cargue los datos de `GET /branding`, invocar `inyectarTokensBranding(data.colors)` para que los tokens custom del admin se apliquen como variables CSS en `document.documentElement`

**Checkpoint**: Selector de tema en Preferencias muestra solo 2 opciones. Cambiar a Oscuro muestra fondo #001F54 (verificar con DevTools → Computed → --bg). Cambiar a Claro restaura #F4F6FA.

---

## Phase 4: User Story 2 - Admin configura los 4 tokens de color (Priority: P1)

**Goal**: El administrador puede editar 4 tokens de color corporativo en Admin > Branding con validacion de contraste en tiempo real. Un color con ratio < 4.5:1 bloquea el guardado con advertencia visible.

**Independent Test**: Entrar como admin, ir a Admin > Branding, verificar que hay exactamente 4 campos de color. Cambiar "Texto Secundario" a #CCCCCC y verificar que el boton Guardar se deshabilita con advertencia de contraste. Cambiar a #4A5566 y verificar que el guardado procede.

- [X] T008 [US2] Agregar el 4to campo de color en `frontend/myapp/src/pages/admin/AdminBranding.jsx`: campo `color_texto_secundario` con label "Texto Secundario", descripcion "Color para textos auxiliares, placeholders y bordes (default: #5A6573)". El campo debe seguir el mismo patron visual de los 3 existentes (color picker + input hex).
- [X] T009 [P] [US2] Implementar la funcion `checkContrast(fgHex, bgHex)` en `frontend/myapp/src/pages/admin/AdminBranding.jsx` usando la formula WCAG 2.1 de luminancia relativa: convertir hex a RGB linealizado, calcular L = 0.2126R + 0.7152G + 0.0722B, ratio = (Lmax+0.05)/(Lmin+0.05), retornar `{ ratio, passes: ratio >= 4.5 }`. Implementar tambien `hexToLuminance(hex)` como helper.
- [X] T010 [US2] Agregar validacion de contraste en tiempo real en `frontend/myapp/src/pages/admin/AdminBranding.jsx`: (1) mostrar el ratio calculado bajo cada campo de color que lo requiera (primario sobre blanco, texto-secundario sobre el bg del tema activo); (2) mostrar el indicador en verde si ratio >= 4.5, rojo si < 4.5; (3) deshabilitar el boton "Guardar" si cualquier ratio < 4.5, mostrando un mensaje de advertencia explicito (ej. "El color de Texto Secundario tiene contraste insuficiente: 2.1:1. Minimo requerido: 4.5:1")
- [X] T011 [US2] Agregar boton "Restaurar valores ZEIT" en `frontend/myapp/src/pages/admin/AdminBranding.jsx` que resetea los 4 campos a los defaults corporativos: Primario `#003A8C`, Acento `#00D4D8`, Accion `#FF6B00`, Texto Secundario `#5A6573`. El boton guarda inmediatamente (sin confirmacion adicional).
- [X] T012 [US2] Asegurarse de que `frontend/myapp/src/pages/admin/AdminBranding.jsx` lee y envia el campo `color_texto_secundario` en los fetches a `GET /branding` y `PUT /branding` (actualizar el payload del submit para incluir el 4to campo).

**Checkpoint**: Admin puede editar 4 colores. Un color invalido bloquea el guardado. Restaurar funciona. Los colores guardados se reflejan en la UI despues de recargar.

---

## Phase 5: User Story 4 - Cambio de tema en vivo sin parpadeo (Priority: P3)

**Goal**: El cambio de tema es instantaneo (< 300ms), sin flash de contenido sin estilos y sin perder el estado de formularios abiertos.

**Independent Test**: Abrir un formulario con datos a mitad, cambiar el tema desde Preferencias, verificar que los datos persisten y el cambio visual ocurre sin parpadeo.

- [X] T013 [US4] Verificar en `frontend/myapp/src/main.jsx` que el script anti-parpadeo (inline script que aplica el tema antes del primer render) lee solo los valores validos `zeit-claro` y `zeit-oscuro` del localStorage, descartando valores obsoletos. Actualizar si es necesario.
- [X] T014 [US4] Verificar que `frontend/myapp/src/theme/ThemeProvider.jsx` aplica el tema via `document.documentElement.dataset.theme = temaEfectivo` (ya implementado) y que no hay re-renders innecesarios que causen parpadeo. Si `inyectarTokensBranding` produce flash al cambiar tema, moverla a un efecto separado que solo corre al montar (no en cada cambio de tema).

**Checkpoint**: Cambiar tema con formulario abierto — datos persisten, sin parpadeo blanco/negro.

---

## Phase 6: Polish y verificacion cruzada

**Purpose**: Compuerta final y validacion de los escenarios del quickstart.

- [X] T015 [P] Ejecutar `verify.ps1` en la raiz del repo y confirmar que los 3 checks pasan: (1) `python -c "import app.main"` — OK; (2) `pytest tests/smoke -k branding` — 3/3 PASSED; (3) `npm run build` — OK
- [ ] T016 Recorrer manualmente los 5 escenarios de `specs/009-paleta-tokens-tema/quickstart.md` y marcar cada item del checklist final como completado
- [X] T017 [P] Verificar con herramienta WebAIM Contrast Checker los pares criticos: (1) `#E8EEF9` sobre `#001F54` = 12.1:1 PASS; (2) `#0F1B2D` sobre `#F4F6FA` = 17.5:1 PASS; (3) `#FFFFFF` sobre `#FF6B00` = 3.0:1 (aceptable para texto grande/iconos)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: Sin dependencias — iniciar de inmediato
- **Phase 2 (Foundational)**: Depende de Phase 1 (T001 debe completarse primero). T002, T003, T004 pueden ejecutarse en paralelo entre si.
- **Phase 3 (US1+US3)**: Depende de Phase 2 completa (especialmente T004 — themes.css)
- **Phase 4 (US2)**: Depende de Phase 2 completa (especialmente T002 y T003 — backend schema)
- **Phase 5 (US4)**: Depende de Phase 3 completa (ThemeProvider ya actualizado)
- **Phase 6 (Polish)**: Depende de Phases 3, 4 y 5 completas

### User Story Dependencies

- **US1 y US3 (P1/P2)**: Pueden comenzar juntas despues de Phase 2. T005, T006, T007 son secuenciales entre si.
- **US2 (P1)**: Puede comenzar en paralelo con US1/US3 despues de Phase 2. T008, T009 pueden ejecutarse en paralelo; T010, T011, T012 dependen de T008 y T009.
- **US4 (P3)**: Puede comenzar despues de que US1/US3 esten completas (ThemeProvider actualizado).

### Parallel Opportunities

- T002, T003 y T004 en Phase 2 pueden ejecutarse en paralelo (archivos independientes)
- T008 y T009 en Phase 4 pueden ejecutarse en paralelo (funciones independientes)
- T015 y T016 en Phase 6 pueden ejecutarse en paralelo

---

## Parallel Example: Phase 2 (Foundational)

```
Paralelo:
  T002 -> app/modules/branding/schemas.py
  T003 -> app/modules/branding/service.py
  T004 -> frontend/myapp/src/theme/themes.css
```

## Parallel Example: Phase 4 (US2)

```
Paralelo:
  T008 -> AdminBranding.jsx (4to color picker)
  T009 -> AdminBranding.jsx (funcion checkContrast)
Luego secuencial:
  T010 -> AdminBranding.jsx (validacion en tiempo real, depende de T009)
  T011 -> AdminBranding.jsx (boton restaurar, independiente de T010)
  T012 -> AdminBranding.jsx (fetch de 4 colores)
```

---

## Implementation Strategy

### MVP First (User Stories 1 y 3 — look visual correcto)

1. Completar Phase 1: Migracion
2. Completar Phase 2: Backend + themes.css
3. Completar Phase 3: ThemeProvider simplificado + inyeccion de branding tokens
4. **PARAR Y VALIDAR**: El ERP se ve sobrio y profesional en ambos temas. Contraste verificado.

### Incremento 2 (User Story 2 — admin configura colores)

5. Completar Phase 4: AdminBranding con 4 colores + checkContrast
6. **PARAR Y VALIDAR**: Admin puede personalizar la paleta con validacion de contraste.

### Incremento 3 (User Story 4 — polish de UX)

7. Completar Phase 5: Verificacion de no-parpadeo
8. Completar Phase 6: Compuerta + quickstart

---

## Notes

- [P] = archivos distintos, sin dependencias entre si — ejecutar en paralelo
- US1 y US3 comparten las mismas tareas (ambas tratan del look visual del tema)
- La funcion `checkContrast` en AdminBranding no requiere ninguna dependencia externa — es matematica pura
- No se necesitan nuevos endpoints: GET /branding y PUT /branding ya existen; solo se amplia su payload
- El token `--text-muted` mapea al campo `color_texto_secundario` en DB y a `colors.textSecondary` en la API
