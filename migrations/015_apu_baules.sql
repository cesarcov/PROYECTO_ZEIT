-- ============================================================
-- Migration 015: Baúles APU — kits preconfigurados de recursos
-- ============================================================

CREATE TABLE apu_baules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      TEXT NOT NULL,
    descripcion TEXT,
    categoria   TEXT DEFAULT 'general',
    activo      BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE apu_baul_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    baul_id         UUID NOT NULL REFERENCES apu_baules(id) ON DELETE CASCADE,
    tipo_recurso    TEXT NOT NULL CHECK (tipo_recurso IN ('MATERIAL', 'MANO_OBRA', 'EQUIPO')),
    material_id     UUID REFERENCES materials(id) ON DELETE SET NULL,
    recurso_mo_id   UUID REFERENCES recursos_mo(id) ON DELETE SET NULL,
    descripcion     TEXT NOT NULL,
    unidad          TEXT NOT NULL DEFAULT 'UND',
    cantidad_base   NUMERIC(12,4) NOT NULL DEFAULT 1,
    precio_unitario NUMERIC(12,2) DEFAULT 0,
    orden           INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
