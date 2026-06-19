-- ============================================================
-- CeShark ERP — Migration 021
-- Permiso planificacion:manage para roles admin/administracion
-- ============================================================

-- 1. Registrar el nuevo permiso
INSERT INTO permissions (code, description)
VALUES ('planificacion:manage', 'Gestionar planificación semanal y productividad')
ON CONFLICT (code) DO NOTHING;

-- 2. Asignar a Administrador Maestro (tiene todos los permisos)
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'planificacion:manage'
FROM roles r
WHERE r.name = 'Administrador Maestro'
ON CONFLICT DO NOTHING;

-- 3. Asignar a Administrador General (módulo administracion)
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'planificacion:manage'
FROM roles r
WHERE r.name = 'Administrador General'
ON CONFLICT DO NOTHING;

-- Verificación
SELECT r.name, COUNT(rp.permission_code) AS total_permisos
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
WHERE r.name IN ('Administrador Maestro', 'Administrador General')
GROUP BY r.name;
