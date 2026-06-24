-- ============================================================
-- Migration 036: Limpieza de tablas zombie
-- Creadas fuera del sistema de migraciones (directo en pgAdmin),
-- nunca tuvieron código activo en la aplicación.
--
-- Tablas eliminadas:
--   · tool_loans         → duplicado por tool_assignments (más completo)
--   · equipment_maintenance → duplicado por tool_maintenance (más completo)
--   · stock_item_categories → sin código, sin datos, sin FK
--
-- Tablas CONSERVADAS intencionalmente:
--   · material_request_items  → feature 006: solicitudes multi-material
--   · material_request_audit  → feature 006: trazabilidad de aprobaciones
-- ============================================================

-- ── 1. DROP de tablas zombie (sin FK salientes que bloqueen) ─────────────────
DROP TABLE IF EXISTS tool_loans;
DROP TABLE IF EXISTS equipment_maintenance;
DROP TABLE IF EXISTS stock_item_categories;

-- ── 2. DROP de columnas muertas en materials ──────────────────────────────────
-- alias1/2/3 → reemplazadas por tabla material_aliases
-- maintenance_interval_days / last_maintenance → reemplazadas por tool_maintenance
ALTER TABLE materials
    DROP COLUMN IF EXISTS alias1,
    DROP COLUMN IF EXISTS alias2,
    DROP COLUMN IF EXISTS alias3,
    DROP COLUMN IF EXISTS maintenance_interval_days,
    DROP COLUMN IF EXISTS last_maintenance;

-- ── VERIFICACIÓN ──────────────────────────────────────────────────────────────
SELECT 'tool_loans eliminada'              WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tool_loans');
SELECT 'equipment_maintenance eliminada'   WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'equipment_maintenance');
SELECT 'stock_item_categories eliminada'   WHERE NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_item_categories');
SELECT 'materials.alias1 eliminada'        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'alias1');
SELECT 'materials.alias2 eliminada'        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'alias2');
SELECT 'materials.alias3 eliminada'        WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'alias3');
SELECT 'materials.maintenance_interval eliminada' WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'maintenance_interval_days');
SELECT 'materials.last_maintenance eliminada'     WHERE NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'last_maintenance');
