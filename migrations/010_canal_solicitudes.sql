-- ============================================================
-- 010: Canal de Solicitudes Inter-Módulo
-- Permite comunicación formal entre Operaciones, Logística,
-- Administración y el Administrador Maestro mediante solicitudes
-- con hilo de mensajes.
-- ============================================================

CREATE TABLE canal_solicitudes (
    id           SERIAL       PRIMARY KEY,
    code         VARCHAR(20)  UNIQUE NOT NULL,
    from_module  VARCHAR(50)  NOT NULL,
    to_module    VARCHAR(50)  NOT NULL,
    subject      VARCHAR(200) NOT NULL,
    description  TEXT,
    priority     VARCHAR(20)  NOT NULL DEFAULT 'NORMAL',
    status       VARCHAR(30)  NOT NULL DEFAULT 'PENDIENTE',
    created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    resolved_at  TIMESTAMP
);

CREATE TABLE canal_mensajes (
    id           SERIAL    PRIMARY KEY,
    solicitud_id INTEGER   NOT NULL REFERENCES canal_solicitudes(id) ON DELETE CASCADE,
    user_id      UUID      REFERENCES users(id) ON DELETE SET NULL,
    mensaje      TEXT      NOT NULL,
    created_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canal_sol_from   ON canal_solicitudes(from_module);
CREATE INDEX idx_canal_sol_to     ON canal_solicitudes(to_module);
CREATE INDEX idx_canal_sol_status ON canal_solicitudes(status);
CREATE INDEX idx_canal_msg_sol    ON canal_mensajes(solicitud_id);
