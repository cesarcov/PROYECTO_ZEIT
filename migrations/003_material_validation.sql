-- ============================================================
-- CeShark ERP Modular — Migration 003
-- Materiales propuestos por ingenieros de campo.
-- Permite que operaciones proponga materiales no catalogados
-- y logística los valide antes de que queden en el catálogo oficial.
-- ============================================================

-- Estado de validación del material
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS validation_status VARCHAR(20) NOT NULL DEFAULT 'VALIDATED';

-- Quién propuso el material (NULL = creado por logística directamente)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS proposed_by UUID REFERENCES users(id);

-- Cuándo fue propuesto
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS proposed_at TIMESTAMP;

-- Quién validó
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS validated_by UUID REFERENCES users(id);

-- Cuándo fue validado
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP;

-- Notas internas de logística sobre el material (proveedor alternativo, etc.)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS logistics_notes TEXT;

-- Permiso para que logística valide materiales propuestos
INSERT INTO permissions (code, description) VALUES
    ('logistics:materials:validate', 'Validar materiales propuestos por ingenieros de campo')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- Dar el permiso a Logística y Administrador
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'logistics:materials:validate'
FROM roles r
WHERE r.name IN ('Logística', 'Administrador')
ON CONFLICT DO NOTHING;

-- Permiso para que ingenieros propongan materiales
INSERT INTO permissions (code, description) VALUES
    ('operations:materials:propose', 'Proponer nuevos materiales al catálogo desde un plan de proyecto')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'operations:materials:propose'
FROM roles r
WHERE r.name IN ('Ingeniero de Campo', 'Supervisor', 'Administrador')
ON CONFLICT DO NOTHING;

SELECT 'Migration 003 applied: material validation workflow added' AS result;
