-- ============================================================
-- CeShark ERP Modular — Migration 017
-- Materiales con estado ACTIVO/PENDIENTE/INACTIVO
-- Permite proponer materiales desde APU con precio referencial
-- ============================================================

-- Estado visible del material (distinto de validation_status interno)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO';

-- Precio referencial dado al proponer (antes de validación logística)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS precio_referencia DECIMAL(12,2);

-- Origen de la propuesta: 'COTIZACION' | 'OT' | 'MANUAL'
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS propuesto_desde VARCHAR(30);

-- Plan de cotización desde donde se propuso (trazabilidad)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS cotizacion_origen_id UUID;

-- Proveedor referencial en texto libre (para que logística investigue)
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS proveedor_referencia TEXT;

-- Índice para filtrar por estado eficientemente
CREATE INDEX IF NOT EXISTS idx_materials_estado ON materials(estado);

-- Migrar materiales ya pendientes del sistema anterior
UPDATE materials SET estado = 'PENDIENTE' WHERE validation_status = 'PENDING';

-- Permiso para proponer materiales desde Operaciones
INSERT INTO permissions (code, description) VALUES
    ('operations:materials:propose', 'Proponer nuevos materiales al catálogo desde APU')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- Asignar a los roles de operaciones (si no está ya de migration 003)
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'operations:materials:propose'
FROM roles r
WHERE r.name IN ('Ingeniero de Campo', 'Supervisor', 'Administrador',
                 'Supervisor de Operaciones', 'Jefe de Operaciones')
ON CONFLICT DO NOTHING;

SELECT 'Migration 017 applied: materials estado + precio_referencia + propuesto_desde + cotizacion_origen_id + proveedor_referencia' AS result;
