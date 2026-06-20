<!-- SPECKIT START -->
## Feature activo: 002-tema-apariencia

Plan de implementación: `specs/002-tema-apariencia/plan.md`

Contexto técnico (para esta feature — tramo 002a: motor + armazón):
- Frontend: React 18 · Vite · TailwindCSS v4 · theming por **variables CSS** (`data-theme`) + Context API (`ThemeProvider`)
- Backend: Python 3.11 · FastAPI · psycopg2 — preferencias en `users.preferencias` (JSONB), endpoints `GET/PUT /auth/me/preferences`
- Datos: PostgreSQL — migración `034_user_preferencias.sql`
- 5 temas: zeit-claro, zeit-oscuro, zeit-oscuro-energia, zeit-turquesa, zeit-grafito (regla: naranja nunca principal)
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` + `npm run build`)

Para detalles del QUÉ/CÓMO, leer el plan y la spec en `specs/002-tema-apariencia/`.
<!-- SPECKIT END -->
