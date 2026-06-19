-- ============================================================
-- 007: Bóvedas / Grupos predefinidos de materiales
-- Plantillas reutilizables para añadir conjuntos de materiales
-- a un plan de proyecto de una sola vez.
-- ============================================================

CREATE TABLE IF NOT EXISTS material_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(150) NOT NULL,
    description TEXT,
    category    VARCHAR(100) NOT NULL DEFAULT 'General',
    created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS material_group_items (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id        UUID            NOT NULL REFERENCES material_groups(id) ON DELETE CASCADE,
    material_id     UUID            NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    quantity        DECIMAL(12,4)   NOT NULL DEFAULT 1,
    wear_percentage DECIMAL(5,2)    NOT NULL DEFAULT 100,
    notes           TEXT,
    UNIQUE(group_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_material_group_items_group ON material_group_items(group_id);
CREATE INDEX IF NOT EXISTS idx_material_groups_category   ON material_groups(category);
