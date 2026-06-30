-- 040_user_block_permissions.sql
-- Tabla de asignación explícita de bloques de acceso por usuario

CREATE TABLE IF NOT EXISTS user_block_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    block_slug  VARCHAR(30) NOT NULL
                CHECK (block_slug IN ('logistica', 'operaciones', 'administracion', 'gerencia')),
    level       VARCHAR(10) NOT NULL CHECK (level IN ('view', 'edit')),
    granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, block_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_block_permissions_user_id
    ON user_block_permissions (user_id);
