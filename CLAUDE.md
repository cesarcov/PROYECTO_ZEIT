<!-- SPECKIT START -->
## Feature activo: 001-export-filtro-responsable

Plan de implementación: `specs/001-export-filtro-responsable/plan.md`

Contexto técnico (para esta feature):
- Backend: Python 3.11 · FastAPI · psycopg2 (SQL crudo) · openpyxl (export Excel)
- Frontend: React 18 · Vite · TailwindCSS
- Datos: PostgreSQL — `planificacion_semanal` (`responsable_id`, `responsables_ids`)
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` + `npm run build`)

Para detalles del QUÉ/CÓMO, leer el plan y la spec en `specs/001-export-filtro-responsable/`.
<!-- SPECKIT END -->
