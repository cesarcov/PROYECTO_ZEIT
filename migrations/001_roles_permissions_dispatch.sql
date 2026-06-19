-- ============================================================
-- CeShark ERP Modular — Migration 001
-- Roles, Permisos y extensión de Despachos
-- Ejecutar: psql -U <usuario> -d <base_de_datos> -f 001_roles_permissions_dispatch.sql
-- ============================================================

-- ── 1. PERMISOS ─────────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
    -- Administración
    ('admin:users',                 'Gestionar usuarios del sistema'),
    ('admin:roles',                 'Gestionar roles y permisos'),
    ('admin:audit',                 'Ver auditoría completa del sistema'),
    ('admin:super',                 'Acceso total al sistema'),
    -- Materiales
    ('logistics:materials:view',    'Ver catálogo de materiales'),
    ('logistics:materials:manage',  'Crear, editar y eliminar materiales'),
    -- Stock
    ('logistics:stock:view',        'Ver stock disponible por almacén'),
    ('logistics:stock:move',        'Registrar movimientos de stock'),
    ('logistics:stock:receive',     'Recibir mercancía e ingresar stock'),
    -- Almacenes y Proyectos
    ('logistics:warehouses:manage', 'Crear y gestionar almacenes'),
    ('logistics:projects:manage',   'Crear y gestionar proyectos'),
    -- Herramientas
    ('logistics:tools:manage',      'Asignar herramientas y registrar mantenimientos'),
    -- Despacho (nuevo)
    ('logistics:dispatch:create',   'Crear despachos de materiales'),
    ('logistics:dispatch:manage',   'Cambiar estado de despachos (preparar, enviar)'),
    -- Importaciones
    ('logistics:import:materials',  'Importar catálogo de materiales desde Excel'),
    ('logistics:import:stock',      'Importar movimientos de stock desde Excel'),
    -- Reservas
    ('logistics:reservations:view', 'Ver reservas de stock'),
    ('logistics:reservations:manage','Confirmar y liberar reservas'),
    -- Reportes logística
    ('logistics:reports:view',      'Ver reportes e indicadores de logística'),
    -- Solicitudes
    ('requests:create',             'Crear solicitudes de material'),
    ('requests:view:own',           'Ver las propias solicitudes'),
    ('requests:view:all',           'Ver todas las solicitudes del sistema'),
    ('requests:approve',            'Aprobar o rechazar solicitudes de material'),
    -- Entregas / Despachos recibidos
    ('operations:deliveries:view',    'Ver despachos asignados a mí'),
    ('operations:deliveries:confirm', 'Confirmar recepción de materiales despachados'),
    -- Reportes generales
    ('reporting:view',              'Ver reportes operacionales'),
    ('reporting:full',              'Ver todos los reportes del sistema')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;


-- ── 2. ROLES ────────────────────────────────────────────────
INSERT INTO roles (name) VALUES
    ('Administrador'),
    ('Logística'),
    ('Supervisor'),
    ('Ingeniero de Campo')
ON CONFLICT (name) DO NOTHING;


-- ── 3. ASIGNAR PERMISOS A ROLES ─────────────────────────────

-- Limpiar asignaciones existentes para re-asignar limpio
-- (solo en roles que vamos a redefinir — no afecta roles custom)
DELETE FROM role_permissions
WHERE role_id IN (SELECT id FROM roles WHERE name IN (
    'Administrador', 'Logística', 'Supervisor', 'Ingeniero de Campo'
));

-- ── Administrador: TODOS los permisos ──
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Administrador'
ON CONFLICT DO NOTHING;

-- ── Logística: todo excepto admin:super ──
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Logística'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:materials:manage',
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
    'requests:view:all',
    'requests:approve',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;

-- ── Supervisor: aprobar, ver todo, proyectos ──
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Supervisor'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:projects:manage',
    'logistics:reports:view',
    'logistics:reservations:view',
    'requests:create',
    'requests:view:own',
    'requests:view:all',
    'requests:approve',
    'operations:deliveries:view',
    'operations:deliveries:confirm',
    'reporting:view',
    'reporting:full'
  )
ON CONFLICT DO NOTHING;

-- ── Ingeniero de Campo: solicitar, ver propio, confirmar entrega ──
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r, permissions p
WHERE r.name = 'Ingeniero de Campo'
  AND p.code IN (
    'logistics:materials:view',
    'logistics:stock:view',
    'logistics:projects:manage',
    'requests:create',
    'requests:view:own',
    'operations:deliveries:view',
    'operations:deliveries:confirm'
  )
ON CONFLICT DO NOTHING;


-- ── 4. EXTENDER TABLA stock_dispatches ──────────────────────
-- Añadir columnas que faltan para el flujo completo de despacho
-- (IF NOT EXISTS protege contra re-ejecución)

ALTER TABLE stock_dispatches
    ADD COLUMN IF NOT EXISTS recipient_user_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS request_id        UUID REFERENCES material_requests(id),
    ADD COLUMN IF NOT EXISTS dispatched_at     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS receipt_notes     TEXT,
    ADD COLUMN IF NOT EXISTS recipient_name    VARCHAR(200);

-- Normalizar status: renombrar CREATED → PENDING si existe
UPDATE stock_dispatches SET status = 'PENDING'  WHERE status = 'CREATED';
UPDATE stock_dispatches SET status = 'DELIVERED' WHERE status = 'DISPATCHED';


-- ── 5. VERIFICACIÓN ─────────────────────────────────────────
SELECT 'Permisos creados: ' || COUNT(*)::text FROM permissions;
SELECT 'Roles creados: '    || COUNT(*)::text FROM roles;
SELECT 'Asignaciones: '     || COUNT(*)::text FROM role_permissions;

-- Resumen de permisos por rol
SELECT r.name, COUNT(rp.permission_code) AS total_permisos
FROM roles r
LEFT JOIN role_permissions rp ON rp.role_id = r.id
GROUP BY r.name
ORDER BY r.name;
