-- Migración 032: Multi-responsables y Mejoras en Planificación Semanal
ALTER TABLE planificacion_semanal ADD COLUMN IF NOT EXISTS responsables_ids TEXT;
ALTER TABLE planificacion_semanal ADD COLUMN IF NOT EXISTS seguimientos_ids TEXT;
ALTER TABLE planificacion_semanal ALTER COLUMN contacto TYPE TEXT;

-- Inicializar campos con datos existentes para no romper nada
UPDATE planificacion_semanal 
SET responsables_ids = responsable_id::text 
WHERE responsable_id IS NOT NULL AND responsables_ids IS NULL;

UPDATE planificacion_semanal 
SET seguimientos_ids = seguimiento_id::text 
WHERE seguimiento_id IS NOT NULL AND seguimientos_ids IS NULL;
