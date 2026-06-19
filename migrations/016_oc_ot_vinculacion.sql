-- Migration 016: Vinculación OC ↔ OT (Fase 5A)
-- Permite generar una OC directamente desde una OT con material insuficiente

ALTER TABLE ot_materiales
    ADD COLUMN IF NOT EXISTS oc_id UUID REFERENCES ordenes_compra(id);

ALTER TABLE ordenes_compra
    ADD COLUMN IF NOT EXISTS ot_origen_id UUID REFERENCES ordenes_trabajo(id);

CREATE INDEX IF NOT EXISTS idx_ot_mat_oc ON ot_materiales(oc_id)
    WHERE oc_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_oc_ot_origen ON ordenes_compra(ot_origen_id)
    WHERE ot_origen_id IS NOT NULL;
