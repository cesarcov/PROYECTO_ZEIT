-- ============================================================
-- CeShark ERP — Migration 027
-- Rol Gerente General + fix permisos Administrador General
-- ============================================================

-- 1. Registrar permisos nuevos
INSERT INTO permissions (code, description) VALUES
    ('gerencia:approve',       'Aprobar solicitudes de gerencia (visitas, cotizaciones, compras)'),
    ('gerencia:view',          'Ver panel de aprobaciones y reportes de gerencia')
ON CONFLICT (code) DO NOTHING;

-- 2. Crear rol Gerente General
INSERT INTO roles (name) VALUES ('Gerente General')
ON CONFLICT (name) DO NOTHING;

-- 3. Asignar permisos al Gerente General
DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'Gerente General');

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Gerente General'
  AND p.code IN (
    -- Gerencia
    'gerencia:approve',
    'gerencia:view',
    -- Reportes (acceso a KPIs y reportes ejecutivos)
    'reporting:view',
    'reporting:full',
    -- Vista de operaciones
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:reports:view',
    'logistics:reservations:view',
    'logistics:plan_submissions:view',
    -- Solicitudes y aprobaciones
    'requests:view:all',
    'requests:approve',
    -- Compras / OCs
    'operations:deliveries:view'
  )
ON CONFLICT DO NOTHING;

-- 4. Agregar admin:audit al Administrador General (para que pueda acceder a Auditoría)
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'admin:audit'
FROM roles r
WHERE r.name = 'Administrador General'
ON CONFLICT DO NOTHING;

-- 5. Re-asignar frank_sonco a Gerente General (en caso de que migración 026 haya fallado)
DELETE FROM user_roles
WHERE user_id = (SELECT id FROM users WHERE username = 'frank_sonco');

INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'frank_sonco'
  AND r.name = 'Gerente General'
ON CONFLICT DO NOTHING;

-- Verificación
SELECT r.name, COUNT(rp.permission_code) AS permisos
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
WHERE r.name IN ('Gerente General', 'Administrador General')
GROUP BY r.name;

SELECT u.username, r.name AS rol
FROM users u
JOIN user_roles ur ON ur.user_id = u.id
JOIN roles r ON r.id = ur.role_id
WHERE u.username = 'frank_sonco';
