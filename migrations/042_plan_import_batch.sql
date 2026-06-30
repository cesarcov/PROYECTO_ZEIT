-- 042_plan_import_batch.sql
-- Agregar columna import_batch_id a planificacion_semanal
ALTER TABLE planificacion_semanal ADD COLUMN IF NOT EXISTS import_batch_id VARCHAR(50);
CREATE INDEX IF NOT EXISTS idx_plan_sem_import_batch ON planificacion_semanal(import_batch_id);
