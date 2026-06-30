-- 041_user_full_name.sql
-- Agregar campo full_name a la tabla de usuarios
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

-- Inicializar nombres para usuarios predeterminados
UPDATE users SET full_name = 'TI - Ceshark' WHERE username = 'admin';
UPDATE users SET full_name = 'Wilfredo Flores' WHERE username = 'wilfredo_flores';
