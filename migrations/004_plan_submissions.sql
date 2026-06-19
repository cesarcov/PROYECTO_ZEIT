-- ============================================================
-- CeShark ERP Modular — Migration 004
-- Requerimientos de proyecto en lotes (submissions).
-- El ingeniero puede enviar múltiples requerimientos
-- numerados para el mismo plan de proyecto.
-- Logística recibe cada lote como una lista completa
-- y puede aprobar/rechazar ítem por ítem.
-- ============================================================

-- ── 1. Estado de envío por ítem en el plan ──────────────────
ALTER TABLE project_plan_items
    ADD COLUMN IF NOT EXISTS submission_status VARCHAR(20) NOT NULL DEFAULT 'PENDING';
-- PENDING   : aún no enviado a logística
-- IN_REVIEW : enviado, esperando revisión
-- APPROVED  : aprobado por logística (100%)
-- PARTIAL   : aprobado parcialmente
-- REJECTED  : rechazado

-- ── 2. Lotes de envío (submissions) ────────────────────────
CREATE TABLE IF NOT EXISTS project_plan_submissions (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id           UUID        NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    submission_number INTEGER     NOT NULL,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING | IN_REVIEW | PARTIAL | APPROVED | REJECTED
    reason            TEXT,
    submitted_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    reviewed_at       TIMESTAMP,
    reviewed_by       UUID        REFERENCES users(id),
    logistics_notes   TEXT,
    UNIQUE(plan_id, submission_number)
);

-- ── 3. Ítems de cada lote (snapshot al momento del envío) ──
CREATE TABLE IF NOT EXISTS project_plan_submission_items (
    id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id     UUID            NOT NULL REFERENCES project_plan_submissions(id) ON DELETE CASCADE,
    plan_item_id      UUID            NOT NULL REFERENCES project_plan_items(id),
    material_id       UUID            NOT NULL REFERENCES materials(id),
    material_name     VARCHAR(200)    NOT NULL,
    material_code     VARCHAR(50),
    category          VARCHAR(100),
    quantity          DECIMAL(12,3)   NOT NULL,
    unit_cost         DECIMAL(12,2),
    wear_percentage   DECIMAL(5,2)    NOT NULL DEFAULT 100,
    stock_available   DECIMAL(12,3)   DEFAULT 0,
    logistics_status  VARCHAR(20)     NOT NULL DEFAULT 'PENDING',
    -- PENDING | APPROVED | PARTIAL | REJECTED
    approved_quantity DECIMAL(12,3),
    logistics_notes   TEXT,
    reviewed_at       TIMESTAMP
);

-- ── 4. Migrar planes SUBMITTED → ACTIVE ────────────────────
-- Los planes ya enviados bajo el modelo antiguo pasan a ACTIVE
-- (abiertos, editables, con historial de submission existente).
UPDATE project_plans SET status = 'ACTIVE' WHERE status = 'SUBMITTED';

-- ── 5. Permisos ─────────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
    ('logistics:plan_submissions:view',   'Ver requerimientos de proyecto de todos los ingenieros'),
    ('logistics:plan_submissions:review', 'Aprobar o rechazar ítems de requerimientos de proyecto')
ON CONFLICT (code) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r
CROSS JOIN (VALUES
    ('logistics:plan_submissions:view'),
    ('logistics:plan_submissions:review')
) AS p(code)
WHERE r.name IN ('Logística', 'Administrador', 'Supervisor')
ON CONFLICT DO NOTHING;

SELECT 'Migration 004 applied: project plan submissions model' AS result;
