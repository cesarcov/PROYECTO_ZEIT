-- Migration 018: Matriz de Tarifas de Personal
-- El mismo rol tiene tarifas distintas según contexto, ubicación y modalidad.

CREATE TABLE IF NOT EXISTS tarifas_personal (
    id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    rol                  VARCHAR(100) NOT NULL,
    -- Ej: "Técnico E/I", "Supervisor Operativo", "Soldador", "Especialista Ingeniería"
    contexto             VARCHAR(30)  NOT NULL,
    -- PARADA | PROYECTO | SERVICIO | INGENIERIA
    ubicacion            VARCHAR(30)  NOT NULL,
    -- MINA | AREQUIPA | INDUSTRIA | CUALQUIERA
    modalidad            VARCHAR(10)  NOT NULL,
    -- HORA | DIA
    horas_por_dia        INTEGER      DEFAULT 8,
    -- Cuántas horas efectivas tiene 1 día (8 o 12 según cliente/contrato)
    tarifa               DECIMAL(10,2) NOT NULL,
    tarifa_hora_extra    DECIMAL(10,2),
    -- NULL = no aplica hora extra para este rol/contexto
    moneda               VARCHAR(5)   NOT NULL DEFAULT 'PEN',
    incluye_epp          BOOLEAN      NOT NULL DEFAULT FALSE,
    incluye_herramientas BOOLEAN      NOT NULL DEFAULT FALSE,
    notas                TEXT,
    activo               BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tarifas_rol      ON tarifas_personal(rol);
CREATE INDEX IF NOT EXISTS idx_tarifas_contexto ON tarifas_personal(contexto);
CREATE INDEX IF NOT EXISTS idx_tarifas_activo   ON tarifas_personal(activo);

-- Una sola tarifa activa por combinación rol+contexto+ubicacion+modalidad
CREATE UNIQUE INDEX IF NOT EXISTS idx_tarifas_unico
    ON tarifas_personal(rol, contexto, ubicacion, modalidad)
    WHERE activo = TRUE;

-- Datos de ejemplo representativos del modelo de negocio CeShark
INSERT INTO tarifas_personal
    (rol, contexto, ubicacion, modalidad, horas_por_dia, tarifa, tarifa_hora_extra, incluye_epp, incluye_herramientas, notas)
VALUES
    ('Técnico E/I',           'PARADA',     'MINA',       'DIA',  12, 230.00, 28.00, FALSE, FALSE, 'Turno 12h en minería'),
    ('Técnico E/I',           'PARADA',     'AREQUIPA',   'DIA',   8, 180.00, 22.00, FALSE, FALSE, 'Turno 8h ciudad'),
    ('Técnico E/I',           'PROYECTO',   'INDUSTRIA',  'HORA',  8,  25.00, 35.00, FALSE, FALSE, NULL),
    ('Técnico E/I',           'SERVICIO',   'CUALQUIERA', 'HORA',  8,  22.00, 30.00, FALSE, FALSE, 'Tarifa general servicio'),
    ('Supervisor Operativo',  'PARADA',     'MINA',       'DIA',  12, 380.00, 45.00, FALSE, FALSE, 'Turno 12h en minería'),
    ('Supervisor Operativo',  'SERVICIO',   'AREQUIPA',   'HORA',  8,  45.00, 60.00, FALSE, FALSE, NULL),
    ('Supervisor Operativo',  'PROYECTO',   'INDUSTRIA',  'DIA',   8, 300.00, 38.00, FALSE, FALSE, NULL),
    ('Especialista Ingeniería','INGENIERIA','CUALQUIERA', 'HORA',  8,  80.00,  NULL, FALSE, FALSE, 'Sin hora extra diferenciada'),
    ('Soldador',              'PARADA',     'MINA',       'DIA',  12, 210.00, 25.00, FALSE, TRUE,  'Incluye herramientas propias'),
    ('Andamiero',             'PARADA',     'MINA',       'DIA',  12, 170.00, 20.00, FALSE, FALSE, NULL)
ON CONFLICT DO NOTHING;
