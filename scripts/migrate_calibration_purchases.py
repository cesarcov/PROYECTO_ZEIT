"""Migration: calibration_records + purchase_items tables + calibration fields on materials."""
import sys
sys.path.insert(0, ".")
from app.core.database import db_connection

SQL = """
-- Calibration fields on materials
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS calibration_required    BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS calibration_interval_days INTEGER,
    ADD COLUMN IF NOT EXISTS calibration_cert_url    TEXT;

-- Calibration history records
CREATE TABLE IF NOT EXISTS calibration_records (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id      UUID NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    calibrated_at    DATE NOT NULL,
    expires_at       DATE NOT NULL,
    certificate_url  TEXT,
    technician       VARCHAR(200),
    notes            TEXT,
    created_by       TEXT,
    created_at       TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calibration_records_material ON calibration_records(material_id);
CREATE INDEX IF NOT EXISTS idx_calibration_records_expires  ON calibration_records(expires_at);

-- Purchase items (pending acquisitions)
CREATE TABLE IF NOT EXISTS purchase_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id         UUID REFERENCES materials(id),
    material_name_free  TEXT,
    qty_needed          NUMERIC NOT NULL DEFAULT 1,
    unit                TEXT,
    project_id          UUID REFERENCES projects(id),
    source              VARCHAR(50)  DEFAULT 'MANUAL',
    reason              TEXT,
    priority            VARCHAR(20)  DEFAULT 'NORMAL',
    status              VARCHAR(20)  DEFAULT 'PENDING',
    supplier_notes      TEXT,
    created_by          TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    updated_at          TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_purchase_items_project  ON purchase_items(project_id);
CREATE INDEX IF NOT EXISTS idx_purchase_items_status   ON purchase_items(status);
CREATE INDEX IF NOT EXISTS idx_purchase_items_material ON purchase_items(material_id);
"""

with db_connection() as conn:
    cur = conn.cursor()
    cur.execute(SQL)
    conn.commit()
    print("Migration completed successfully.")

    # Verify
    cur.execute("SELECT column_name FROM information_schema.columns WHERE table_name='materials' AND column_name LIKE 'calibration%'")
    print("Calibration cols on materials:", [r[0] for r in cur.fetchall()])
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_name IN ('calibration_records','purchase_items')")
    print("New tables:", [r[0] for r in cur.fetchall()])
