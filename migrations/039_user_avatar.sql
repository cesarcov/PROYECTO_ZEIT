-- Migration 039: Agregar columna avatar_url a la tabla de usuarios
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
