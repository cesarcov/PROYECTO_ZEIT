-- Migración 025: Asignación de responsable a subtareas
ALTER TABLE planificacion_subtareas ADD COLUMN IF NOT EXISTS responsable_id UUID REFERENCES users(id) ON DELETE SET NULL;
