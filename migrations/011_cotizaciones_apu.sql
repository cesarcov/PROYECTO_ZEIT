-- ============================================================
-- 011: Cotizaciones S10-style — APU (Análisis de Precios Unitarios)
-- Permite que cada plan de proyecto tenga un presupuesto formal
-- con partidas y desglose por Material / Mano de Obra / Equipo.
-- Exportable a PDF (reportlab) y Excel (openpyxl).
-- ============================================================

-- Recursos de Mano de Obra (tarifas por hora/día)
CREATE TABLE recursos_mo (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo       VARCHAR(20)  UNIQUE NOT NULL,      -- MO-001, MO-002, ...
    descripcion  VARCHAR(200) NOT NULL,              -- Técnico Electricista
    categoria    VARCHAR(100) NOT NULL DEFAULT 'Operario', -- Operario / Supervisor / Especialista
    tarifa_hora  DECIMAL(10,2) NOT NULL DEFAULT 0,  -- Costo por hora en S/
    unidad       VARCHAR(20)  NOT NULL DEFAULT 'HH', -- HH = Hora Hombre, HD = Hora/Día
    activo       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Partidas del presupuesto (estructura jerárquica tipo S10)
-- Una partida es un ítem de trabajo con código, descripción y cantidad.
-- Puede ser capítulo (agrupador sin APU) o partida normal (con APU).
CREATE TABLE presupuesto_partidas (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id      UUID         NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    codigo       VARCHAR(30)  NOT NULL,              -- 01, 01.01, 01.02, 02, ...
    descripcion  VARCHAR(300) NOT NULL,
    unidad       VARCHAR(30)  NOT NULL DEFAULT 'GLB', -- UND, ML, M2, GLB, HH, etc.
    cantidad     DECIMAL(12,3) NOT NULL DEFAULT 1,
    orden        INTEGER      NOT NULL DEFAULT 0,
    es_capitulo  BOOLEAN      NOT NULL DEFAULT FALSE, -- TRUE = fila agrupadora sin APU
    parent_id    UUID         REFERENCES presupuesto_partidas(id), -- jerarquía: capítulo > partida
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Ítems APU de cada partida (recursos que componen el costo unitario)
CREATE TABLE presupuesto_apu_items (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    partida_id      UUID         NOT NULL REFERENCES presupuesto_partidas(id) ON DELETE CASCADE,
    tipo_recurso    VARCHAR(20)  NOT NULL,  -- 'MATERIAL' | 'MANO_OBRA' | 'EQUIPO'
    material_id     UUID         REFERENCES materials(id),      -- si tipo=MATERIAL o EQUIPO
    recurso_mo_id   UUID         REFERENCES recursos_mo(id),    -- si tipo=MANO_OBRA
    descripcion     VARCHAR(200),                               -- descripción libre si no hay FK
    unidad          VARCHAR(30),
    cantidad        DECIMAL(12,4) NOT NULL DEFAULT 1,
    precio_unitario DECIMAL(12,4) NOT NULL DEFAULT 0,
    -- precio_unitario se copia al guardar (snapshot, igual que bóvedas — no referencia viva)
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Configuración del presupuesto (una por plan de proyecto)
-- Guarda los porcentajes y datos del cliente para la cotización.
CREATE TABLE presupuesto_config (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id              UUID         UNIQUE NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    gastos_generales_pct DECIMAL(5,2) NOT NULL DEFAULT 12.00,  -- % sobre costo directo
    utilidad_pct         DECIMAL(5,2) NOT NULL DEFAULT 10.00,
    igv_pct              DECIMAL(5,2) NOT NULL DEFAULT 18.00,
    moneda               VARCHAR(10)  NOT NULL DEFAULT 'PEN',
    cliente_nombre       VARCHAR(200),
    cliente_ruc          VARCHAR(20),
    lugar_trabajo        VARCHAR(300),
    plazo_dias           INTEGER,
    validez_dias         INTEGER      NOT NULL DEFAULT 30,
    notas                TEXT,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_partidas_plan     ON presupuesto_partidas(plan_id);
CREATE INDEX idx_partidas_parent   ON presupuesto_partidas(parent_id);
CREATE INDEX idx_apu_partida       ON presupuesto_apu_items(partida_id);
CREATE INDEX idx_apu_tipo          ON presupuesto_apu_items(tipo_recurso);
CREATE INDEX idx_recursos_mo_cod   ON recursos_mo(codigo);
CREATE INDEX idx_recursos_mo_activo ON recursos_mo(activo);
