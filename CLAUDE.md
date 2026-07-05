<!-- SPECKIT START -->
## Feature activo: 009-paleta-tokens-tema

Plan de implementacion: `specs/009-paleta-tokens-tema/plan.md`

Contexto tecnico (para esta feature):
- Backend: Python 3.11 · FastAPI · psycopg2 — sin dependencias nuevas
- Migracion: `041_branding_color_texto_secundario.sql` — ADD COLUMN en tabla `branding`
- Backend modificado: `app/modules/branding/schemas.py` + `service.py` (4to token de color)
- Frontend CSS: `src/theme/themes.css` — eliminar 4 temas extra, ajustar `zeit-oscuro` a `#001F54`
- Frontend JS: `src/theme/ThemeProvider.jsx` — reducir TEMAS a 2 (claro/oscuro), inyectar branding tokens
- Frontend Admin: `src/pages/admin/AdminBranding.jsx` — 4 color pickers + checkContrast() WCAG
- 4 tokens de color: `--primary` (#003A8C), `--accent` (#00D4D8), `--action` (#FF6B00), `--text-muted` (#5A6573)
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` + `npm run build`)

Para detalles del QUE/COMO, leer el plan y la spec en `specs/009-paleta-tokens-tema/`.
<!-- SPECKIT END -->
