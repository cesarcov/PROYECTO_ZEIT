-- ============================================================
-- CeShark ERP — Migration 009
-- Funcionalidades avanzadas de logística:
--   · Trazabilidad por lote
--   · Inventario físico (toma de inventario)
--   · Transferencias entre almacenes
--   · Punto de reposición / stock máximo
--   · Valorización (costo promedio ponderado)
--   · Kardex con costo unitario
--   · Código QR por material/lote
-- ============================================================


-- ── 1. EXTENSIONES A TABLA materials ─────────────────────────
ALTER TABLE materials
    ADD COLUMN IF NOT EXISTS max_stock           NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS reorder_point       NUMERIC(12,2) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS weighted_avg_cost   NUMERIC(12,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lot_tracking        BOOLEAN       DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS qr_code             TEXT;          -- código único p/ QR (= materials.code por defecto)

-- Inicializar qr_code con el código de material existente
UPDATE materials SET qr_code = code WHERE qr_code IS NULL;

-- Inicializar reorder_point = min_stock si es > 0
UPDATE materials SET reorder_point = min_stock WHERE reorder_point = 0 AND min_stock > 0;


-- ── 2. EXTENSIONES A TABLA stock_movements ───────────────────
ALTER TABLE stock_movements
    ADD COLUMN IF NOT EXISTS unit_cost  NUMERIC(12,4) DEFAULT 0,
    ADD COLUMN IF NOT EXISTS lot_id     UUID;           -- FK a stock_lots (se agrega FK después)

-- Inicializar unit_cost con el costo del material al momento de la migración
UPDATE stock_movements sm
SET unit_cost = (SELECT unit_cost FROM materials m WHERE m.id = sm.material_id)
WHERE sm.unit_cost = 0;


-- ── 3. LOTES (trazabilidad por lote) ─────────────────────────
CREATE TABLE IF NOT EXISTS stock_lots (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id        UUID         NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    lot_number         VARCHAR(100) NOT NULL,
    warehouse_id       UUID         REFERENCES warehouses(id),
    quantity           NUMERIC(12,2) NOT NULL DEFAULT 0,
    remaining_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
    unit_cost          NUMERIC(12,4) NOT NULL DEFAULT 0,
    expiry_date        DATE,
    manufacture_date   DATE,
    supplier_name      VARCHAR(200),
    notes              TEXT,
    qr_code            TEXT,        -- código QR específico del lote
    status             VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, DEPLETED, EXPIRED, QUARANTINE
    created_by         UUID         REFERENCES users(id),
    created_at         TIMESTAMP    NOT NULL DEFAULT now(),
    UNIQUE(material_id, lot_number)
);

CREATE INDEX IF NOT EXISTS idx_stock_lots_material ON stock_lots(material_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_warehouse ON stock_lots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_lots_status ON stock_lots(status);

-- Ahora agregar FK de stock_movements.lot_id
ALTER TABLE stock_movements
    ADD CONSTRAINT IF NOT EXISTS fk_stock_movements_lot
    FOREIGN KEY (lot_id) REFERENCES stock_lots(id);


-- ── 4. MOVIMIENTOS POR LOTE ───────────────────────────────────
CREATE TABLE IF NOT EXISTS stock_lot_movements (
    id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    lot_id        UUID         NOT NULL REFERENCES stock_lots(id) ON DELETE CASCADE,
    movement_id   UUID         REFERENCES stock_movements(id),
    quantity      NUMERIC(12,2) NOT NULL,
    movement_type TEXT         NOT NULL,  -- IN, OUT, TRANSFER, ADJUST
    notes         TEXT,
    created_at    TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lot_movements_lot ON stock_lot_movements(lot_id);


-- ── 5. INVENTARIO FÍSICO ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS physical_inventories (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    inv_number   VARCHAR(30)  UNIQUE,     -- INV-YYYY-NNN
    warehouse_id UUID         NOT NULL REFERENCES warehouses(id),
    title        VARCHAR(200) NOT NULL,
    status       VARCHAR(20)  NOT NULL DEFAULT 'OPEN',
    -- OPEN → COUNTING → CLOSED → APPROVED
    notes        TEXT,
    created_by   UUID         REFERENCES users(id),
    approved_by  UUID         REFERENCES users(id),
    started_at   TIMESTAMP    NOT NULL DEFAULT now(),
    closed_at    TIMESTAMP,
    approved_at  TIMESTAMP
);

CREATE TABLE IF NOT EXISTS physical_inventory_items (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id     UUID         NOT NULL REFERENCES physical_inventories(id) ON DELETE CASCADE,
    material_id      UUID         NOT NULL REFERENCES materials(id),
    system_quantity  NUMERIC(12,2),  -- stock del sistema al abrir el inventario
    counted_quantity NUMERIC(12,2),  -- lo que se contó físicamente
    unit_cost        NUMERIC(12,4) DEFAULT 0,
    location_detail  TEXT,            -- rack/nivel/gaveta para referencia del conteo
    adjusted         BOOLEAN      DEFAULT FALSE,
    notes            TEXT,
    counted_by       UUID         REFERENCES users(id),
    counted_at       TIMESTAMP,
    UNIQUE(inventory_id, material_id)
);

-- Secuencia para número de inventario
CREATE SEQUENCE IF NOT EXISTS physical_inventory_seq START 1;

CREATE INDEX IF NOT EXISTS idx_phys_inv_warehouse ON physical_inventories(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_phys_inv_items ON physical_inventory_items(inventory_id);


-- ── 6. TRANSFERENCIAS ENTRE ALMACENES ────────────────────────
CREATE TABLE IF NOT EXISTS warehouse_transfers (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_number   VARCHAR(30) UNIQUE,     -- TRF-YYYY-NNN
    from_warehouse_id UUID        NOT NULL REFERENCES warehouses(id),
    to_warehouse_id   UUID        NOT NULL REFERENCES warehouses(id),
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING → APPROVED → IN_TRANSIT → RECEIVED → CANCELLED
    notes             TEXT,
    requested_by      UUID        REFERENCES users(id),
    approved_by       UUID        REFERENCES users(id),
    received_by       UUID        REFERENCES users(id),
    requested_at      TIMESTAMP   NOT NULL DEFAULT now(),
    approved_at       TIMESTAMP,
    received_at       TIMESTAMP,
    CHECK (from_warehouse_id <> to_warehouse_id)
);

CREATE TABLE IF NOT EXISTS warehouse_transfer_items (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id        UUID         NOT NULL REFERENCES warehouse_transfers(id) ON DELETE CASCADE,
    material_id        UUID         NOT NULL REFERENCES materials(id),
    quantity_requested NUMERIC(12,2) NOT NULL,
    quantity_sent      NUMERIC(12,2),
    quantity_received  NUMERIC(12,2),
    unit_cost          NUMERIC(12,4) DEFAULT 0,
    notes              TEXT
);

-- Secuencias para numeración automática
CREATE SEQUENCE IF NOT EXISTS warehouse_transfer_seq START 1;

CREATE INDEX IF NOT EXISTS idx_transfers_from ON warehouse_transfers(from_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_to   ON warehouse_transfers(to_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_transfers_status ON warehouse_transfers(status);


-- ── 7. NUEVOS PERMISOS ────────────────────────────────────────
INSERT INTO permissions (code, description) VALUES
    ('logistics:lots:view',           'Ver lotes y trazabilidad por lote'),
    ('logistics:lots:manage',         'Crear y gestionar lotes de stock'),
    ('logistics:physical_inv:view',   'Ver inventarios físicos'),
    ('logistics:physical_inv:manage', 'Realizar y aprobar inventarios físicos'),
    ('logistics:transfers:view',      'Ver transferencias entre almacenes'),
    ('logistics:transfers:manage',    'Crear y gestionar transferencias entre almacenes'),
    ('logistics:valuation:view',      'Ver valorización del inventario')
ON CONFLICT (code) DO NOTHING;


-- ── 8. ASIGNAR NUEVOS PERMISOS A ROLES ───────────────────────

-- Administrador Maestro: todos los nuevos permisos
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Administrador Maestro'
  AND p.code IN (
    'logistics:lots:view','logistics:lots:manage',
    'logistics:physical_inv:view','logistics:physical_inv:manage',
    'logistics:transfers:view','logistics:transfers:manage',
    'logistics:valuation:view'
  )
ON CONFLICT DO NOTHING;

-- Gerente Logístico: todos los nuevos permisos
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Gerente Logístico'
  AND p.code IN (
    'logistics:lots:view','logistics:lots:manage',
    'logistics:physical_inv:view','logistics:physical_inv:manage',
    'logistics:transfers:view','logistics:transfers:manage',
    'logistics:valuation:view'
  )
ON CONFLICT DO NOTHING;

-- Coordinador Logístico: gestión completa
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Coordinador Logístico'
  AND p.code IN (
    'logistics:lots:view','logistics:lots:manage',
    'logistics:physical_inv:view','logistics:physical_inv:manage',
    'logistics:transfers:view','logistics:transfers:manage',
    'logistics:valuation:view'
  )
ON CONFLICT DO NOTHING;

-- Operador Logístico: solo vista + crear lotes y transferencias
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Operador Logístico'
  AND p.code IN (
    'logistics:lots:view','logistics:lots:manage',
    'logistics:transfers:view','logistics:transfers:manage'
  )
ON CONFLICT DO NOTHING;

-- Administrador General: solo vista
INSERT INTO role_permissions (role_id, permission_code)
SELECT r.id, p.code
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'Administrador General'
  AND p.code IN (
    'logistics:lots:view',
    'logistics:physical_inv:view',
    'logistics:transfers:view',
    'logistics:valuation:view'
  )
ON CONFLICT DO NOTHING;


-- ── VERIFICACIÓN ─────────────────────────────────────────────
SELECT 'stock_lots created'            WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'stock_lots');
SELECT 'physical_inventories created'  WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'physical_inventories');
SELECT 'warehouse_transfers created'   WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'warehouse_transfers');
SELECT 'materials.max_stock added'     WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'materials' AND column_name = 'max_stock');
SELECT 'stock_movements.unit_cost added' WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'stock_movements' AND column_name = 'unit_cost');
