-- ============================================================
-- Migration 012 — Órdenes de Trabajo (SAP PM-style)
-- Fase 2 del roadmap CeShark ERP
-- ============================================================

-- Órdenes de Trabajo
CREATE TABLE ordenes_trabajo (
    id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    code                VARCHAR(20) UNIQUE NOT NULL,
    plan_id             UUID        REFERENCES project_plans(id),
    partida_id          UUID        REFERENCES presupuesto_partidas(id),
    titulo              VARCHAR(300) NOT NULL,
    descripcion         TEXT,
    tipo                VARCHAR(50) NOT NULL DEFAULT 'CORRECTIVO',
    -- CORRECTIVO | PREVENTIVO | EMERGENCIA
    prioridad           VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    -- URGENTE | ALTA | NORMAL | BAJA
    status              VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    -- PENDIENTE → EN_EJECUCION → PAUSADA → COMPLETADA → CERRADA | CANCELADA
    asignado_a          UUID        REFERENCES users(id),
    creado_por          UUID        REFERENCES users(id),
    fecha_inicio_plan   TIMESTAMP,
    fecha_fin_plan      TIMESTAMP,
    fecha_inicio_real   TIMESTAMP,
    fecha_fin_real      TIMESTAMP,
    horas_estimadas     DECIMAL(8,2),
    horas_reales        DECIMAL(8,2),
    lugar_trabajo       VARCHAR(300),
    observaciones       TEXT,
    created_at          TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Checklist de pasos de la OT
CREATE TABLE ot_checklist (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id           UUID        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    orden           INTEGER     NOT NULL DEFAULT 0,
    descripcion     VARCHAR(300) NOT NULL,
    completado      BOOLEAN     NOT NULL DEFAULT FALSE,
    completado_por  UUID        REFERENCES users(id),
    completado_at   TIMESTAMP,
    notas           TEXT
);

-- Materiales consumidos (al cerrar OT → stock_movement SALIDA)
CREATE TABLE ot_materiales (
    id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id             UUID    NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    material_id       UUID    NOT NULL REFERENCES materials(id),
    almacen_id        UUID    REFERENCES warehouses(id),
    cantidad_plan     DECIMAL(12,4),
    cantidad_real     DECIMAL(12,4) NOT NULL DEFAULT 0,
    registrado_por    UUID    REFERENCES users(id),
    stock_movement_id UUID,
    created_at        TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Registro de tiempo de trabajo (cronómetro)
CREATE TABLE ot_tiempos (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    ot_id       UUID        NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
    tecnico_id  UUID        REFERENCES users(id),
    inicio      TIMESTAMP   NOT NULL,
    fin         TIMESTAMP,
    horas       DECIMAL(6,2),
    notas       TEXT
);

-- Índices
CREATE INDEX idx_ot_plan      ON ordenes_trabajo(plan_id);
CREATE INDEX idx_ot_asignado  ON ordenes_trabajo(asignado_a);
CREATE INDEX idx_ot_status    ON ordenes_trabajo(status);
CREATE INDEX idx_ot_mat_ot    ON ot_materiales(ot_id);
CREATE INDEX idx_ot_check_ot  ON ot_checklist(ot_id);
CREATE INDEX idx_ot_time_ot   ON ot_tiempos(ot_id);
