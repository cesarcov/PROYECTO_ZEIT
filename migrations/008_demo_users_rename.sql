-- ============================================================
-- CeShark ERP — Migration 008
-- Renombrar usuarios demo y crear usuario Administración
-- ============================================================
-- Ejecutar: psql -U <usuario> -d <base_de_datos> -f 008_demo_users_rename.sql
-- ============================================================


-- ── 1. RENOMBRAR "log" → "logistica" ─────────────────────────
UPDATE users
SET
    username        = 'logistica',
    email           = 'logistica@ceshark.com',
    hashed_password = '$2b$12$6sj8pC7/nyiwgc5EL2yDaebqlSAVdRvmB2kVvFcujyO2mRIug8W9C'
WHERE username = 'log';


-- ── 2. RENOMBRAR "operario" → "operaciones" ──────────────────
UPDATE users
SET
    username        = 'operaciones',
    email           = 'operaciones@ceshark.com',
    hashed_password = '$2b$12$QbaUR2NLZQkEsvVf9ZU9SuRUs7CVrPtJbqiLkIslaxzFXCuuJ5oYe'
WHERE username = 'operario';


-- ── 3. ASEGURAR ROL de "logistica" → Coordinador Logístico ───
-- (por si el rename del usuario trae un rol distinto)
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Coordinador Logístico')
WHERE user_id = (SELECT id FROM users WHERE username = 'logistica')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = (SELECT id FROM users WHERE username = 'logistica')
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Coordinador Logístico')
  );


-- ── 4. ASEGURAR ROL de "operaciones" → Supervisor de Operaciones
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
WHERE user_id = (SELECT id FROM users WHERE username = 'operaciones')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = (SELECT id FROM users WHERE username = 'operaciones')
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
  );


-- ── 5. AGREGAR admin:audit al rol "Administrador General" ────
-- Necesario para que el frontend lo enrute a /admin
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'admin:audit'
FROM roles r
WHERE r.name = 'Administrador General'
ON CONFLICT DO NOTHING;


-- ── 6. CREAR usuario "administracion" (si no existe) ─────────
INSERT INTO users (username, email, hashed_password, is_active)
SELECT
    'administracion',
    'administracion@ceshark.com',
    '$2b$12$XVSwLDQbZIz0.Wk8K5QqQefFzJUwyGfqjcLgSvI4fDNq12b3qtSha',
    TRUE
WHERE NOT EXISTS (
    SELECT 1 FROM users WHERE username = 'administracion'
);


-- ── 7. ASIGNAR ROL "Administrador General" a "administracion" ─
INSERT INTO user_roles (user_id, role_id)
SELECT
    u.id,
    r.id
FROM users u, roles r
WHERE u.username = 'administracion'
  AND r.name     = 'Administrador General'
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = u.id AND ur.role_id = r.id
  );


-- ── VERIFICACIÓN ─────────────────────────────────────────────
SELECT
    u.username,
    u.email,
    u.is_active,
    STRING_AGG(r.name, ', ') AS roles
FROM users u
LEFT JOIN user_roles ur ON ur.user_id = u.id
LEFT JOIN roles r        ON r.id = ur.role_id
WHERE u.username IN ('admin', 'logistica', 'operaciones', 'administracion')
GROUP BY u.username, u.email, u.is_active
ORDER BY u.username;
