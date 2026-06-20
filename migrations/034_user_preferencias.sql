-- Migración 034: Preferencias del usuario (incluye el tema de la interfaz)
-- El tema vive en preferencias->>'tema'. Guarda defensiva: NULL/{} => "system".
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferencias JSONB NOT NULL DEFAULT '{}'::jsonb;
