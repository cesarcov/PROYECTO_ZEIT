-- ============================================================
-- Migration 006 — Purgar roles legacy y dejar solo estructura nueva
-- ============================================================

-- ── 1. MIGRAR USUARIOS de roles legacy a nuevos equivalentes ─

-- admin → Administrador Maestro
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Administrador Maestro')
WHERE role_id = (SELECT id FROM roles WHERE name = 'admin')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Administrador Maestro')
  );

-- Administrador → Administrador Maestro
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Administrador Maestro')
WHERE role_id = (SELECT id FROM roles WHERE name = 'Administrador')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Administrador Maestro')
  );

-- Logística → Coordinador Logístico
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Coordinador Logístico')
WHERE role_id = (SELECT id FROM roles WHERE name = 'Logística')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Coordinador Logístico')
  );

-- logistics_manager → Gerente Logístico
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Gerente Logístico')
WHERE role_id = (SELECT id FROM roles WHERE name = 'logistics_manager')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Gerente Logístico')
  );

-- logistics_operator → Operador Logístico
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Operador Logístico')
WHERE role_id = (SELECT id FROM roles WHERE name = 'logistics_operator')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Operador Logístico')
  );

-- Supervisor → Supervisor de Operaciones
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
WHERE role_id = (SELECT id FROM roles WHERE name = 'Supervisor')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
  );

-- operations → Supervisor de Operaciones
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
WHERE role_id = (SELECT id FROM roles WHERE name = 'operations')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Supervisor de Operaciones')
  );

-- viewer (minúscula) → Viewer
UPDATE user_roles
SET role_id = (SELECT id FROM roles WHERE name = 'Viewer')
WHERE role_id = (SELECT id FROM roles WHERE name = 'viewer')
  AND NOT EXISTS (
    SELECT 1 FROM user_roles ur2
    WHERE ur2.user_id = user_roles.user_id
      AND ur2.role_id = (SELECT id FROM roles WHERE name = 'Viewer')
  );


-- ── 2. ELIMINAR roles legacy (permisos → asignaciones → rol) ─

DELETE FROM role_permissions
WHERE role_id IN (
    SELECT id FROM roles
    WHERE name IN (
        'admin', 'Administrador', 'Logística',
        'Supervisor', 'logistics_manager', 'logistics_operator',
        'viewer', 'operations'
    )
);

DELETE FROM user_roles
WHERE role_id IN (
    SELECT id FROM roles
    WHERE name IN (
        'admin', 'Administrador', 'Logística',
        'Supervisor', 'logistics_manager', 'logistics_operator',
        'viewer', 'operations'
    )
);

DELETE FROM roles
WHERE name IN (
    'admin', 'Administrador', 'Logística',
    'Supervisor', 'logistics_manager', 'logistics_operator',
    'viewer', 'operations'
);


-- ── 3. VERIFICACIÓN FINAL ────────────────────────────────────
SELECT
    r.name                                       AS rol,
    COUNT(DISTINCT rp.permission_code)           AS permisos,
    COUNT(DISTINCT ur.user_id)                   AS usuarios
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
LEFT JOIN user_roles ur       ON ur.role_id = r.id
GROUP BY r.name
ORDER BY permisos DESC;
