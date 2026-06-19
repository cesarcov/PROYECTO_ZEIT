-- ============================================================
-- Migration 013 — Proveedores y Órdenes de Compra (Odoo-style)
-- Fase 3 del roadmap CeShark ERP
-- ============================================================

-- Proveedores
CREATE TABLE proveedores (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(20) UNIQUE NOT NULL,
    nombre       VARCHAR(200) NOT NULL,
    ruc          VARCHAR(15)  UNIQUE,
    direccion    TEXT,
    telefono     VARCHAR(50),
    email        VARCHAR(200),
    contacto     VARCHAR(150),
    tipo         VARCHAR(50)  NOT NULL DEFAULT 'PROVEEDOR', -- PROVEEDOR | SUBCONTRATISTA
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Catálogo de precios: qué materiales ofrece cada proveedor y a qué precio
CREATE TABLE material_proveedores (
    id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id         UUID          NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    proveedor_id        UUID          NOT NULL REFERENCES proveedores(id) ON DELETE CASCADE,
    precio_unitario     DECIMAL(12,4) NOT NULL,
    moneda              VARCHAR(10)   NOT NULL DEFAULT 'PEN',
    tiempo_entrega_dias INTEGER       NOT NULL DEFAULT 1,
    es_principal        BOOLEAN       NOT NULL DEFAULT FALSE,
    updated_at          TIMESTAMP     NOT NULL DEFAULT NOW(),
    UNIQUE(material_id, proveedor_id)
);

-- Órdenes de Compra
CREATE TABLE ordenes_compra (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(20)   UNIQUE NOT NULL,
    proveedor_id      UUID          NOT NULL REFERENCES proveedores(id),
    plan_id           UUID          REFERENCES project_plans(id),
    status            VARCHAR(30)   NOT NULL DEFAULT 'BORRADOR',
    -- BORRADOR → ENVIADA → APROBADA → EN_TRANSITO → RECIBIDA → CERRADA | CANCELADA
    solicitado_por    UUID          REFERENCES users(id),
    aprobado_por      UUID          REFERENCES users(id),
    almacen_destino   UUID          REFERENCES warehouses(id),
    fecha_solicitud   TIMESTAMP     NOT NULL DEFAULT NOW(),
    fecha_entrega_est TIMESTAMP,
    fecha_recepcion   TIMESTAMP,
    notas             TEXT,
    total_estimado    DECIMAL(14,2),
    total_real        DECIMAL(14,2),
    created_at        TIMESTAMP     NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP     NOT NULL DEFAULT NOW()
);

-- Ítems de la OC
CREATE TABLE ordenes_compra_items (
    id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    oc_id             UUID          NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
    material_id       UUID          NOT NULL REFERENCES materials(id),
    cantidad_pedida   DECIMAL(12,4) NOT NULL,
    precio_unitario   DECIMAL(12,4) NOT NULL,
    cantidad_recibida DECIMAL(12,4) NOT NULL DEFAULT 0,
    stock_movement_id UUID,
    notas             TEXT
);

-- Índices
CREATE INDEX idx_oc_proveedor  ON ordenes_compra(proveedor_id);
CREATE INDEX idx_oc_status     ON ordenes_compra(status);
CREATE INDEX idx_oc_plan       ON ordenes_compra(plan_id);
CREATE INDEX idx_oc_items_oc   ON ordenes_compra_items(oc_id);
CREATE INDEX idx_mat_prov_mat  ON material_proveedores(material_id);
CREATE INDEX idx_mat_prov_prov ON material_proveedores(proveedor_id);
