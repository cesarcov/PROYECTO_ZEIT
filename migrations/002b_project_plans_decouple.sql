-- ============================================================
-- CeShark ERP Modular — Migration 002b
-- Desacoplar project_plans de la tabla projects de logística.
-- El ingeniero de operaciones crea su propio plan con nombre libre.
-- ============================================================

-- Hacer project_id opcional (NULL = plan sin proyecto logístico vinculado)
ALTER TABLE project_plans
    ALTER COLUMN project_id DROP NOT NULL;

-- Nombre libre del proyecto que escribe el ingeniero
ALTER TABLE project_plans
    ADD COLUMN IF NOT EXISTS custom_project_name VARCHAR(200);

-- Código de obra / referencia interna (opcional)
ALTER TABLE project_plans
    ADD COLUMN IF NOT EXISTS project_code VARCHAR(50);

SELECT 'Migration 002b applied: project_plans now allows NULL project_id' AS result;
