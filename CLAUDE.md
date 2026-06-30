<!-- SPECKIT START -->
## Feature activo: 008-control-acceso-bloques

Plan de implementación: `specs/008-control-acceso-bloques/plan.md`

Contexto técnico (para esta feature):
- Backend: Python 3.11 · FastAPI · psycopg2 — sin dependencias nuevas
- Nueva tabla: `user_block_permissions (user_id, block_slug, level)` — migración 040
- Bloque slugs válidos: `logistica`, `operaciones`, `administracion`, `gerencia`
- Niveles: `view` (solo lectura) o `edit` (lectura + escritura)
- Constantes centralizadas: `app/core/blocks.py` (VALID_BLOCKS, BLOCK_TO_MODULES)
- Nuevos endpoints en `app/modules/superadmin/`: GET/PUT /superadmin/users + /blocks
- JWT ampliado: campo `blocks: [{slug, level}]` añadido al payload (sin romper `modules`)
- Superadmin: recibe `blocks="all"` (string), Layout detecta y muestra todo
- Ghost button fix: `Layout.jsx` línea ~419 — `visibleModules` filtra por `auth.blocks`, no por `auth.modules`
- Frontend nuevo: `src/constants/blocks.js` + `src/pages/admin/SuperadminUserBlocks.jsx`
- Frontend modificado: `useAuth.js` (auth.blocks + canEditBlock()), `Login.jsx` (guarda blocks en localStorage)
- Compuerta: `verify.ps1` (import backend + `pytest tests/smoke` + `npm run build`)

Para detalles del QUÉ/CÓMO, leer el plan y la spec en `specs/008-control-acceso-bloques/`.
<!-- SPECKIT END -->
