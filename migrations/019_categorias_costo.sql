-- Migration 019: Categorías de Costo Configurables
-- Reemplaza el enum fijo de tipos de recurso por una tabla dinámica.

-- ── 1. TABLA categorias_costo ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categorias_costo (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(20)  UNIQUE NOT NULL,
    nombre       VARCHAR(100) NOT NULL,
    es_directo   BOOLEAN      NOT NULL DEFAULT TRUE,
    orden        INTEGER      NOT NULL DEFAULT 0,
    color_hex    VARCHAR(7)   DEFAULT '#4F7C82',
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- ── 2. CATEGORÍAS POR DEFECTO ────────────────────────────────────────────────
INSERT INTO categorias_costo (codigo, nombre, es_directo, orden, color_hex) VALUES
    ('MO',  'Mano de Obra',      TRUE,  1, '#0B6E4F'),
    ('MAT', 'Materiales',        TRUE,  2, '#1A6B8A'),
    ('EQP', 'Equipos',           TRUE,  3, '#7B5EA7'),
    ('SUM', 'Suministros',       TRUE,  4, '#C07A2A'),
    ('SUB', 'Subcontratas',      TRUE,  5, '#A04040'),
    ('ING', 'Ingeniería',        TRUE,  6, '#2A7A7A'),
    ('TRA', 'Traslado',          TRUE,  7, '#5A6A3A'),
    ('IND', 'Costos Indirectos', FALSE, 8, '#4F7C82')
ON CONFLICT (codigo) DO NOTHING;

-- ── 3. LIMPIEZA DE RESTRICCIONES LEGACY ──────────────────────────────────────
ALTER TABLE apu_baul_items
    DROP CONSTRAINT IF EXISTS apu_baul_items_tipo_recurso_check;

-- ── 4. MIGRACIÓN DE DATOS EXISTENTES ─────────────────────────────────────────
UPDATE presupuesto_apu_items SET tipo_recurso = 'MO'  WHERE tipo_recurso = 'MANO_OBRA';
UPDATE presupuesto_apu_items SET tipo_recurso = 'MAT' WHERE tipo_recurso = 'MATERIAL';
UPDATE presupuesto_apu_items SET tipo_recurso = 'EQP' WHERE tipo_recurso = 'EQUIPO';

UPDATE apu_baul_items SET tipo_recurso = 'MO'  WHERE tipo_recurso = 'MANO_OBRA';
UPDATE apu_baul_items SET tipo_recurso = 'MAT' WHERE tipo_recurso = 'MATERIAL';
UPDATE apu_baul_items SET tipo_recurso = 'EQP' WHERE tipo_recurso = 'EQUIPO';
