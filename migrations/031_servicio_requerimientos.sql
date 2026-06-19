-- Migración: Módulo de Requerimientos de Servicios y Costos

-- 1. servicio_requerimientos (Cabecera)
CREATE TABLE IF NOT EXISTS servicio_requerimientos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre_servicio VARCHAR(255) NOT NULL,
    descripcion TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    estado VARCHAR(50) NOT NULL DEFAULT 'Cotizado', -- Cotizado, En Curso, Finalizado, Cancelado
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- 2. servicio_requerimiento_costos (Detalle de costos asociados al requerimiento)
CREATE TABLE IF NOT EXISTS servicio_requerimiento_costos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requerimiento_id UUID NOT NULL REFERENCES servicio_requerimientos(id) ON DELETE CASCADE,
    categoria VARCHAR(100) NOT NULL, -- 'Hospedaje', 'Transporte', 'Alimentación', 'Exámenes Médicos', 'Seguros', 'Otros'
    descripcion TEXT NOT NULL,       -- e.g. "Alquiler de camioneta 4x4", "Habitación doble por 5 días"
    costo_unitario NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cantidad NUMERIC(12, 2) NOT NULL DEFAULT 1.00,
    total NUMERIC(12, 2) GENERATED ALWAYS AS (costo_unitario * cantidad) STORED,
    detalles JSONB,                 -- Metadatos de cada categoría (ej. lista de personal, número de placa, pólizas)
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL
);

-- Índices para búsquedas optimizadas
CREATE INDEX IF NOT EXISTS idx_servicio_requerimientos_cliente ON servicio_requerimientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_servicio_requerimiento_costos_req ON servicio_requerimiento_costos(requerimiento_id);
