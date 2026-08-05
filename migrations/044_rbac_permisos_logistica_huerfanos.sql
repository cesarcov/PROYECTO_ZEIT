-- 044 — Registra los permisos de logística avanzada que faltaban.
--
-- F-000 / T-10. Bug detectado por `test_rbac_matrix`:
-- 19 endpoints de logística avanzada (lotes, transferencias, inventario físico
-- y valuación) exigen permisos vía require_permission(...) que NO existían en
-- la tabla `permissions` ni estaban concedidos a ningún rol. Resultado: esos
-- endpoints devolvían 403 a TODO el mundo, incluido el Administrador Maestro.
--
-- Los endpoints afectados los introdujo la migración 009 (logística avanzada),
-- que creó las tablas pero no registró los permisos correspondientes.
--
-- Criterio de reparto:
--   · Administrador Maestro  → todo, es el rol de acceso total.
--   · Gerente Logístico      → ver y gestionar su módulo completo.
--   · Coordinador Logístico  → ver y gestionar operación diaria.
--   · Operador Logístico     → sólo lectura.
--   · Auditor / Viewer       → sólo lectura.
--   · logistics:admin:reset  → SÓLO Administrador Maestro (borra datos).

BEGIN;

-- 1. Catálogo de permisos ────────────────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
    ('logistics:lots:view',           'Ver lotes y trazabilidad de materiales'),
    ('logistics:lots:manage',         'Crear lotes y registrar sus movimientos'),
    ('logistics:transfers:view',      'Ver transferencias entre almacenes'),
    ('logistics:transfers:manage',    'Crear, recibir y cambiar el estado de transferencias'),
    ('logistics:physical_inv:view',   'Ver inventarios físicos'),
    ('logistics:physical_inv:manage', 'Crear, contar, aprobar y cerrar inventarios físicos'),
    ('logistics:valuation:view',      'Ver la valuación del inventario'),
    ('logistics:admin:reset',         'Reiniciar los datos de logística (destructivo)')
ON CONFLICT (code) DO NOTHING;

-- 2. Concesión a roles ───────────────────────────────────────────────────────

-- Administrador Maestro: todos, incluido el destructivo.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (VALUES
    ('logistics:lots:view'), ('logistics:lots:manage'),
    ('logistics:transfers:view'), ('logistics:transfers:manage'),
    ('logistics:physical_inv:view'), ('logistics:physical_inv:manage'),
    ('logistics:valuation:view'), ('logistics:admin:reset')
) AS p(code)
WHERE r.name = 'Administrador Maestro'
ON CONFLICT DO NOTHING;

-- Gerente Logístico y Coordinador Logístico: ver + gestionar (sin el reset).
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (VALUES
    ('logistics:lots:view'), ('logistics:lots:manage'),
    ('logistics:transfers:view'), ('logistics:transfers:manage'),
    ('logistics:physical_inv:view'), ('logistics:physical_inv:manage'),
    ('logistics:valuation:view')
) AS p(code)
WHERE r.name IN ('Gerente Logístico', 'Coordinador Logístico')
ON CONFLICT DO NOTHING;

-- Operador Logístico: opera lotes y transferencias, no aprueba inventarios.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (VALUES
    ('logistics:lots:view'), ('logistics:lots:manage'),
    ('logistics:transfers:view'), ('logistics:transfers:manage'),
    ('logistics:physical_inv:view')
) AS p(code)
WHERE r.name = 'Operador Logístico'
ON CONFLICT DO NOTHING;

-- Auditor y Viewer: estrictamente lectura.
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (VALUES
    ('logistics:lots:view'),
    ('logistics:transfers:view'),
    ('logistics:physical_inv:view'),
    ('logistics:valuation:view')
) AS p(code)
WHERE r.name IN ('Auditor', 'Viewer')
ON CONFLICT DO NOTHING;

COMMIT;
