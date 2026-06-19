-- ============================================================
-- CeShark ERP — Migration 005
-- Estructura completa de roles empresariales
-- ============================================================

-- ── 1. CREAR ROLES (sin borrar los existentes) ───────────────
INSERT INTO roles (name) VALUES
    ('Administrador Maestro'),
    ('Gerente Logístico'),
    ('Coordinador Logístico'),
    ('Operador Logístico'),
    ('Supervisor de Operaciones'),
    ('Ingeniero de Campo'),
    ('Administrador General'),
    ('Asistente Administrativo'),
    ('Tesorería'),
    ('Auditor'),
    ('Viewer')
ON CONFLICT (name) DO NOTHING;


-- ── 2. LIMPIAR ASIGNACIONES EXISTENTES (solo estos roles) ────
DELETE FROM role_permissions
WHERE role_id IN (
    SELECT id FROM roles WHERE name IN (
        'Administrador Maestro',
        'Gerente Logístico',
        'Coordinador Logístico',
        'Operador Logístico',
        'Supervisor de Operaciones',
        'Ingeniero de Campo',
        'Administrador General',
        'Asistente Administrativo',
        'Tesorería',
        'Auditor',
        'Viewer'
    )
);


-- ── 3. ADMINISTRADOR MAESTRO — acceso total ──────────────────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Administrador Maestro'
ON CONFLICT DO NOTHING;


-- ── 4. GERENTE LOGÍSTICO — supervisa toda la cadena ──────────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Gerente Logístico'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:materials:manage',
    'logistics:materials:validate',
    'logistics:stock:view',
    'logistics:stock:move',
    'logistics:stock:receive',
    'logistics:warehouses:manage',
    'logistics:projects:manage',
    'logistics:tools:manage',
    'logistics:dispatch:create',
    'logistics:dispatch:manage',
    'logistics:import:materials',
    'logistics:import:stock',
    'logistics:reservations:view',
    'logistics:reservations:manage',
    'logistics:reports:view',
    'logistics:plan_submissions:view',
    'logistics:plan_submissions:review',
    'requests:view:all',
    'requests:approve',
    'operations:deliveries:view',
    'operations:deliveries:confirm',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;


-- ── 5. COORDINADOR LOGÍSTICO — operaciones logísticas diarias ─
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Coordinador Logístico'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:materials:manage',
    'logistics:materials:validate',
    'logistics:stock:view',
    'logistics:stock:move',
    'logistics:stock:receive',
    'logistics:warehouses:manage',
    'logistics:tools:manage',
    'logistics:dispatch:create',
    'logistics:dispatch:manage',
    'logistics:reservations:view',
    'logistics:reservations:manage',
    'logistics:reports:view',
    'logistics:plan_submissions:view',
    'logistics:plan_submissions:review',
    'requests:view:all',
    'requests:approve',
    'reporting:view'
  )
ON CONFLICT DO NOTHING;


-- ── 6. OPERADOR LOGÍSTICO — registra movimientos físicos ──────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Operador Logístico'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:stock:move',
    'logistics:stock:receive',
    'logistics:dispatch:create',
    'logistics:reservations:view',
    'requests:view:all'
  )
ON CONFLICT DO NOTHING;


-- ── 7. SUPERVISOR DE OPERACIONES — ve, aprueba, coordina campo ─
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Supervisor de Operaciones'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:projects:manage',
    'logistics:reports:view',
    'logistics:plan_submissions:view',
    'logistics:plan_submissions:review',
    'requests:create',
    'requests:view:own',
    'requests:view:all',
    'requests:approve',
    'operations:deliveries:view',
    'operations:deliveries:confirm',
    'operations:plans:manage',
    'operations:materials:propose',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;


-- ── 8. INGENIERO DE CAMPO — solicita, crea planes, confirma ──
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Ingeniero de Campo'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'requests:create',
    'requests:view:own',
    'operations:deliveries:view',
    'operations:deliveries:confirm',
    'operations:plans:manage',
    'operations:materials:propose'
  )
ON CONFLICT DO NOTHING;


-- ── 9. ADMINISTRADOR GENERAL — compras, documentos, proyectos ─
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Administrador General'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:warehouses:manage',
    'logistics:projects:manage',
    'logistics:reservations:view',
    'logistics:reports:view',
    'logistics:plan_submissions:view',
    'requests:view:all',
    'requests:approve',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;


-- ── 10. ASISTENTE ADMINISTRATIVO — registro y apoyo básico ───
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Asistente Administrativo'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'requests:view:all',
    'reporting:view'
  )
ON CONFLICT DO NOTHING;


-- ── 11. TESORERÍA — pagos, costos, presupuesto ───────────────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Tesorería'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:reports:view',
    'requests:view:all',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;


-- ── 12. AUDITOR — solo lectura, auditoría completa ───────────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Auditor'
  AND p.code IN (
    'admin:audit',
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:reports:view',
    'logistics:plan_submissions:view',
    'requests:view:all',
    'operations:deliveries:view',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;


-- ── 13. VIEWER — solo lectura básica ─────────────────────────
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Viewer'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'reporting:view'
  )
ON CONFLICT DO NOTHING;


-- ── VERIFICACIÓN ─────────────────────────────────────────────
SELECT r.name, COUNT(rp.permission_code) AS permisos
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY r.name
ORDER BY COUNT(rp.permission_code) DESC;
