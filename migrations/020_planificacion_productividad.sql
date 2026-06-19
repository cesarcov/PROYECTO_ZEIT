-- Migration 020: Planificación Semanal y Registro de Productividad
-- Tablas para el módulo de inicio, planificación de tareas y seguimiento diario.

-- ── 1. TABLA planificacion_semanal ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planificacion_semanal (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    prioridad       VARCHAR(20),                        -- 'Alta', 'Media', 'Baja'
    tarea           VARCHAR(500) NOT NULL,
    cliente         VARCHAR(200),
    contacto        VARCHAR(200),
    fecha_solicitud DATE,
    responsable_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    etapa           VARCHAR(100),                       -- 'COTIZACIÓN', 'COORDINACIÓN (OP)', etc.
    estado          VARCHAR(50)  NOT NULL DEFAULT 'En Progreso',
    -- 'En Progreso', 'Retraso', 'En espera', 'Completado'
    fecha_limite    DATE,
    seguimiento_id  UUID REFERENCES users(id) ON DELETE SET NULL,
    notas           TEXT,
    progreso_pct    DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    created_at      TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_sem_responsable ON planificacion_semanal(responsable_id);
CREATE INDEX IF NOT EXISTS idx_plan_sem_estado      ON planificacion_semanal(estado);
CREATE INDEX IF NOT EXISTS idx_plan_sem_fecha_lim   ON planificacion_semanal(fecha_limite);

-- ── 2. TABLA planificacion_subtareas ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS planificacion_subtareas (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    actividad_id UUID         NOT NULL REFERENCES planificacion_semanal(id) ON DELETE CASCADE,
    descripcion  VARCHAR(500) NOT NULL,
    culminado    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plan_sub_actividad ON planificacion_subtareas(actividad_id);

-- ── 3. TABLA registro_productividad ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS registro_productividad (
    id                   UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fecha                DATE     NOT NULL DEFAULT CURRENT_DATE,
    actividad            VARCHAR(500) NOT NULL,
    hora_inicio          TIME     NOT NULL,
    hora_fin             TIME     NOT NULL,
    duracion_minutos     INTEGER  NOT NULL,             -- calculado en backend
    estado               VARCHAR(10) NOT NULL DEFAULT 'F', -- 'A' Activo, 'F' Finalizado
    actividad_semanal_id UUID     REFERENCES planificacion_semanal(id) ON DELETE SET NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prod_user_fecha ON registro_productividad(user_id, fecha);
CREATE INDEX IF NOT EXISTS idx_prod_fecha      ON registro_productividad(fecha);
