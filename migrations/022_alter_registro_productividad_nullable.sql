-- Migration 022: Permitir campos nulos en registro_productividad para soporte de temporizadores activos
ALTER TABLE registro_productividad ALTER COLUMN hora_fin DROP NOT NULL;
ALTER TABLE registro_productividad ALTER COLUMN duracion_minutos DROP NOT NULL;
