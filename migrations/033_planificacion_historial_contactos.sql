-- Migración 033: Historial de planificación + contactos múltiples
CREATE TABLE IF NOT EXISTS planificacion_historial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actividad_id UUID NOT NULL REFERENCES planificacion_semanal(id) ON DELETE CASCADE,
    snapshot JSONB NOT NULL,
    guardado_por VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plan_historial_actividad ON planificacion_historial(actividad_id);

ALTER TABLE planificacion_semanal ADD COLUMN IF NOT EXISTS contactos_ids TEXT;
