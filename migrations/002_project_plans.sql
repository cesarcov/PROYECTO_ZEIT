-- ============================================================
-- CeShark ERP Modular — Migration 002
-- Planes de materiales por proyecto (Project Planning)
-- Ejecutar: psql -U <usuario> -d <base_de_datos> -f 002_project_plans.sql
-- ============================================================

-- ── 1. TABLA PLAN DE PROYECTO ───────────────────────────────
CREATE TABLE IF NOT EXISTS project_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID NOT NULL REFERENCES projects(id),
    engineer_id     UUID NOT NULL REFERENCES users(id),
    title           VARCHAR(200),
    status          VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    -- DRAFT: en construcción | SUBMITTED: enviado a logística
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_plans_engineer ON project_plans(engineer_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_project  ON project_plans(project_id);
CREATE INDEX IF NOT EXISTS idx_project_plans_status   ON project_plans(status);


-- ── 2. TABLA ÍTEMS DEL PLAN ─────────────────────────────────
CREATE TABLE IF NOT EXISTS project_plan_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id         UUID          NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    material_id     UUID          NOT NULL REFERENCES materials(id),
    quantity        DECIMAL(12,3) NOT NULL DEFAULT 1,
    -- wear_percentage: % de uso/desgaste asignado por el ingeniero (0–100)
    -- Ej: herramienta que usará al 40% de su vida → 40
    -- Consumible de uso total → 100
    wear_percentage DECIMAL(5,2)  NOT NULL DEFAULT 100.0,
    notes           TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(plan_id, material_id)
);

CREATE INDEX IF NOT EXISTS idx_plan_items_plan     ON project_plan_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_items_material ON project_plan_items(material_id);


-- ── 3. AGREGAR project_id A material_requests (si no existe) ─
ALTER TABLE material_requests
    ADD COLUMN IF NOT EXISTS project_plan_id UUID REFERENCES project_plans(id);


-- ── 4. PERMISO: operaciones puede ver/gestionar planes ───────
INSERT INTO permissions (code, description) VALUES
    ('operations:plans:manage', 'Crear y gestionar planes de materiales por proyecto')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

-- Asignar a Ingeniero de Campo e Logística y Supervisor
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, 'operations:plans:manage'
FROM roles r
WHERE r.name IN ('Ingeniero de Campo', 'Logística', 'Supervisor', 'Administrador')
ON CONFLICT DO NOTHING;


-- ── 5. VERIFICACIÓN ─────────────────────────────────────────
SELECT 'Tablas creadas: project_plans, project_plan_items' AS result;
SELECT COUNT(*) AS total_plans FROM project_plans;
SELECT COUNT(*) AS total_items FROM project_plan_items;
