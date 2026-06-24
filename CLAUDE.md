<!-- SPECKIT START -->
## Feature activo: 003-marca-configurable

Plan de implementación: `specs/003-marca-configurable/plan.md`

Contexto técnico (para esta feature — white-label):
- Backend: Python 3.11 · FastAPI · psycopg2 — módulo nuevo `app/modules/branding/`; tabla singleton `branding` (migración `035_branding.sql`); imágenes en `app/storage/branding/` servidas vía `StaticFiles` en `/branding-assets`
- API: `GET /branding` (público, lo usa el login) · `PUT/POST/DELETE /branding` (admin, `require_permission("admin:users")`)
- Frontend: React 18 · `brand.js` resuelve la marca desde el servidor (fallback ZEIT); colores corporativos (primario/acento/acción) aplicados como variables CSS sobre la raíz (override de los 5 temas)
- Validación: PNG/SVG/JPG ≤2 MB; el crédito "Powered by CeShark" es FIJO
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` + `npm run build`)

Para detalles del QUÉ/CÓMO, leer el plan y la spec en `specs/003-marca-configurable/`.
<!-- SPECKIT END -->
