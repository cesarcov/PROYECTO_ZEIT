-- ============================================================
-- Migration 014: Clientes + Ciclo formal de Cotización
-- ============================================================

-- 1. Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
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

CREATE INDEX IF NOT EXISTS idx_clientes_ruc    ON clientes(ruc);
CREATE INDEX IF NOT EXISTS idx_clientes_activo ON clientes(activo);

-- 2. Ampliar presupuesto_config con ciclo comercial
ALTER TABLE presupuesto_config
    ADD COLUMN IF NOT EXISTS cliente_id          UUID REFERENCES clientes(id),
    ADD COLUMN IF NOT EXISTS numero_cotizacion   VARCHAR(20) UNIQUE,
    ADD COLUMN IF NOT EXISTS status              VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    ADD COLUMN IF NOT EXISTS fecha_envio         TIMESTAMP,
    ADD COLUMN IF NOT EXISTS fecha_respuesta     TIMESTAMP,
    ADD COLUMN IF NOT EXISTS notas_comerciales   TEXT;

-- status válidos: BORRADOR | ENVIADA | APROBADA | RECHAZADA | EXPIRADA

CREATE INDEX IF NOT EXISTS idx_presupuesto_config_cliente ON presupuesto_config(cliente_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_config_status  ON presupuesto_config(status);
