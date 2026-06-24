-- Migración 035: Configuración de marca (white-label, fila singleton)
-- Campos nullable: NULL = usar el valor ZEIT por defecto.
CREATE TABLE IF NOT EXISTS branding (
    id INT PRIMARY KEY DEFAULT 1,
    nombre_producto TEXT,
    eslogan TEXT,
    logo_incluye_nombre BOOLEAN DEFAULT TRUE,
    color_primario TEXT,
    color_acento TEXT,
    color_accion TEXT,
    logo_claro_path TEXT,
    logo_oscuro_path TEXT,
    isotipo_path TEXT,
    favicon_path TEXT,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT branding_singleton CHECK (id = 1)
);
INSERT INTO branding (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
