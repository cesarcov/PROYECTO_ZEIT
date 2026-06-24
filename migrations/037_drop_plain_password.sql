-- Migración 037: Eliminar columna plain_password de users
-- Motivo: riesgo CRÍTICO de seguridad — contraseñas almacenadas en texto plano.
-- La autenticación usa hashed_password (bcrypt). plain_password nunca debió existir.
ALTER TABLE users DROP COLUMN IF EXISTS plain_password;
