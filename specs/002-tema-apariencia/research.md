# Research & Design Decisions: Sistema de temas

**Phase 0** · Branch `002-tema-apariencia` · 2026-06-20

Sin `NEEDS CLARIFICATION` (resueltos en `/speckit-clarify`). Decisiones de diseño:

### D1 — Tokens con **variables CSS** + atributo `data-theme`

- **Decisión**: Definir todos los colores como variables CSS (ej. `--bg`, `--surface`, `--text`, `--primary`, `--accent`, `--action`, `--sidebar-bg`…). Cada tema es un bloque `[data-theme="zeit-claro"] { … }` en `src/theme/themes.css`. El tema activo se aplica poniendo `document.documentElement.dataset.theme = "<id>"`.
- **Rationale**: Cambio de tema instantáneo (cambiar 1 atributo re-evalúa todas las variables) sin recargar ni re-renderizar React. Compatible con Tailwind v4 (que ya usa variables CSS) y con los estilos inline existentes (que pasarán a leer `var(--token)`).
- **Alternativas rechazadas**: librería de theming (styled-components/MUI) — agrega peso y reescritura; objeto JS de tema pasado por props — obliga a re-render y a tocar cada componente con props.

### D2 — Proveedor de tema (Context API) + "seguir el sistema"

- **Decisión**: Un `ThemeProvider` con `useTheme()` expone `{ tema, setTema, temaEfectivo }`. Si `tema === "system"`, escucha `window.matchMedia('(prefers-color-scheme: dark)')` y resuelve a claro/oscuro automáticamente.
- **Rationale**: Estilo VS Code (FR-007). Centraliza la lógica; los componentes no saben de persistencia.
- **Alternativas rechazadas**: estado local disperso — inconsistente y difícil de persistir.

### D3 — Persistencia en la **cuenta** + caché local anti-parpadeo

- **Decisión**: La preferencia se guarda en `users.preferencias` (JSONB) vía `PUT /auth/me/preferences`. Al cargar la app se lee de la cuenta (`GET /auth/me/preferences` o el `/auth/me` existente). Para evitar el parpadeo del primer render, se cachea el último tema en `localStorage` y un pequeño script en `main.jsx` lo aplica **antes** de pintar; luego se reconcilia con la preferencia de la cuenta tras el login.
- **Rationale**: FR-003 (recordar en cualquier dispositivo) + sin FOUC. El localStorage es solo caché de arranque; la fuente de verdad es la cuenta.
- **Alternativas rechazadas**: solo localStorage (no cumple "en la cuenta"); solo backend sin caché (parpadeo visible en cada carga).

### D4 — Preferencias como **JSONB** general (no una columna por preferencia)

- **Decisión**: Columna `users.preferencias JSONB DEFAULT '{}'`. El tema es `preferencias->>'tema'`. Deja lugar para futuras preferencias (las de la página actual: `compactTable`, `pageSize`, etc., hoy solo en localStorage) sin nuevas migraciones.
- **Rationale**: Flexible y a prueba de futuro; una sola migración. Guarda defensiva: si `preferencias` es `NULL` o no tiene `tema`, se usa `"system"`.
- **Alternativas rechazadas**: columna `tema` dedicada — obliga a migrar de nuevo por cada preferencia futura.

### D5 — Alcance acotado al **armazón** (tramo 002a)

- **Decisión**: Migrar a tokens solo el armazón (Layout/sidebar/header/footer, Login) + Preferencias + logo/branding. Las ~70 vistas de módulo quedan para tramos siguientes.
- **Rationale**: Entregable verificable y de bajo riesgo; evita un cambio gigante imposible de revisar de una. (Decisión del usuario en clarify.)
- **Alternativas rechazadas**: migrar todo de una — enorme superficie de regresión visual, difícil compuerta verde.

### D6 — Catálogo de 5 temas y regla del naranja

- **Decisión**: 5 temas (ver `data-model.md`). El Naranja Energía `#FF6B00` solo se asigna a tokens `--action`/`--accent`/alertas, nunca a `--bg` ni `--primary` (FR-010).
- **Rationale**: El naranja es muy saturado; como fondo/primario cansa la vista. Como acento de acción, refuerza la identidad ZEIT (la onda naranja del logo).
