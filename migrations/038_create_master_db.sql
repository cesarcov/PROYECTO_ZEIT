-- Migración 038: Crear tabla tenants en la Master DB (erp_master)
-- EJECUTAR MANUALMENTE una sola vez contra erp_master:
--   psql -U postgres erp_master -f migrations/038_create_master_db.sql
--
-- NO ejecutar contra las DBs de tenants (no forma parte del runner de migraciones normal).

CREATE TABLE IF NOT EXISTS tenants (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(255) NOT NULL,
    slug             VARCHAR(100) UNIQUE NOT NULL,
    db_name          VARCHAR(100) UNIQUE NOT NULL,
    db_url           TEXT         NOT NULL,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    provision_status VARCHAR(50)  NOT NULL DEFAULT 'pending',
    provision_error  TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON tenants (slug);
