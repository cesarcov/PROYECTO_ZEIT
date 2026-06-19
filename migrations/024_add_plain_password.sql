-- ============================================================
-- CeShark ERP — Migration 024
-- Columna de contraseña plana para soporte de visualización en panel admin
-- ============================================================

-- 1. Agregar columna
ALTER TABLE users ADD COLUMN IF NOT EXISTS plain_password VARCHAR(100);

-- 2. Sembrar contraseñas piloto conocidas
UPDATE users SET plain_password = 'admin123' WHERE username = 'admin';
UPDATE users SET plain_password = 'administracion123' WHERE username = 'administracion';
UPDATE users SET plain_password = 'logistica123' WHERE username = 'logistica';
UPDATE users SET plain_password = 'operaciones123' WHERE username = 'operaciones';

-- Sembrar contraseñas para los nuevos usuarios piloto y El inge
UPDATE users SET plain_password = '123456' WHERE username IN (
    'gerente_general', 'coordinador_logistica1', 'operador_logistica1', 
    'ingeniero_operaciones1', 'ingeniero_operaciones2', 'supervisor_operaciones1', 
    'asistente_admin1', 'asistente_admin2', 'El inge'
);
