-- ============================================================
-- Migration 014: Clientes + Ciclo formal de Cotización
-- ============================================================

-- 1. Tabla de clientes
CREATE TABLE clientes (
    id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo           VARCHAR(20)  UNIQUE NOT NULL,          -- CLI-YYYY-NNNN
    razon_social     VARCHAR(200) NOT NULL,
    ruc              VARCHAR(15),
    direccion        TEXT,
    telefono         VARCHAR(50),
    email            VARCHAR(200),
    contacto         VARCHAR(150),                          -- nombre del contacto principal
    cargo_contacto   VARCHAR(100),
    activo           BOOLEAN      NOT NULL DEFAULT TRUE,
    notas            TEXT,
    created_at       TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_ruc    ON clientes(ruc);
CREATE INDEX idx_clientes_activo ON clientes(activo);

-- 2. Ampliar presupuesto_config con ciclo comercial
ALTER TABLE presupuesto_config
    ADD COLUMN cliente_id          UUID REFERENCES clientes(id),
    ADD COLUMN numero_cotizacion   VARCHAR(20) UNIQUE,
    ADD COLUMN status              VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    ADD COLUMN fecha_envio         TIMESTAMP,
    ADD COLUMN fecha_respuesta     TIMESTAMP,
    ADD COLUMN notas_comerciales   TEXT;

-- status válidos: BORRADOR | ENVIADA | APROBADA | RECHAZADA | EXPIRADA

CREATE INDEX idx_presupuesto_config_cliente ON presupuesto_config(cliente_id);
CREATE INDEX idx_presupuesto_config_status  ON presupuesto_config(status);
