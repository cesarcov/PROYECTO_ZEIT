-- ============================================================
-- CeShark ERP — Migration 023
-- Estructura de Aprobaciones de Gerencia y Visitas Técnicas
-- ============================================================

-- 1. Tabla de Visitas Técnicas (Fase Comercial)
CREATE TABLE IF NOT EXISTS visitas_tecnicas (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id        UUID           NOT NULL REFERENCES project_plans(id) ON DELETE CASCADE,
    motivo         VARCHAR(500)   NOT NULL,
    destino        VARCHAR(300)   NOT NULL,
    costo_estimado DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
    estado         VARCHAR(30)    NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE | APROBADA | RECHAZADA
    creado_por     UUID           REFERENCES users(id) ON DELETE SET NULL,
    fecha_visita   DATE,
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_visitas_plan ON visitas_tecnicas(plan_id);
CREATE INDEX IF NOT EXISTS idx_visitas_estado ON visitas_tecnicas(estado);

-- 2. Tabla de Aprobaciones de Gerencia (Consolidada)
CREATE TABLE IF NOT EXISTS aprobaciones_gerencia (
    id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo           VARCHAR(30)    NOT NULL, -- 'VISITA_TECNICA' | 'COTIZACION' | 'PRESTAMO_COMPRA'
    referencia_id  UUID           NOT NULL, -- ID de visita, config o compra
    titulo         VARCHAR(200)   NOT NULL,
    descripcion    TEXT           NOT NULL,
    monto          DECIMAL(12,2),
    estado         VARCHAR(20)    NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE | APROBADO | RECHAZADO
    solicitado_por UUID           NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notas_gerencia TEXT,
    created_at     TIMESTAMP      NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP      NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aprobaciones_tipo ON aprobaciones_gerencia(tipo);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_estado ON aprobaciones_gerencia(estado);
CREATE INDEX IF NOT EXISTS idx_aprobaciones_ref ON aprobaciones_gerencia(referencia_id);

-- 3. Sembrar datos piloto para aprobaciones
DO $$
DECLARE
    u_operaciones_id UUID;
    u_logistica_id UUID;
    p_boroo_id UUID;
    p_prodise_id UUID;
    prov_komatsu_id UUID;
    visita_id UUID;
    oc_id UUID;
    pc_id UUID;
    wh_id UUID;
BEGIN
    -- Obtener IDs de usuarios piloto
    SELECT id INTO u_operaciones_id FROM users WHERE username = 'ingeniero_operaciones1' LIMIT 1;
    SELECT id INTO u_logistica_id FROM users WHERE username = 'coordinador_logistica1' LIMIT 1;
    
    -- Obtener IDs de planes de proyecto piloto
    SELECT id INTO p_boroo_id FROM project_plans WHERE title = 'Servicio de Ingeniería y Construcción de Barcaza de bombeo - Boroo' LIMIT 1;
    SELECT id INTO p_prodise_id FROM project_plans WHERE title = 'Suministro e instalacion de camaras Biespectrales' LIMIT 1;

    -- Obtener ID de proveedor piloto
    SELECT id INTO prov_komatsu_id FROM proveedores WHERE codigo = 'PROV-KOMATSU' OR nombre = 'KOMATSU MITSUI MAQUINARIAS PERU S.A.' LIMIT 1;
    IF prov_komatsu_id IS NULL THEN
        SELECT id INTO prov_komatsu_id FROM proveedores LIMIT 1;
    END IF;

    -- Obtener almacén de destino piloto
    SELECT id INTO wh_id FROM warehouses LIMIT 1;

    -- Si existen los planes y usuarios, procedemos a insertar
    IF u_operaciones_id IS NOT NULL AND p_boroo_id IS NOT NULL THEN
        -- A. VISITA TÉCNICA
        INSERT INTO visitas_tecnicas (plan_id, motivo, destino, costo_estimado, estado, creado_por, fecha_visita)
        VALUES (
            p_boroo_id, 
            'Inspección y levantamiento de información en terreno para diseño de barcaza de bombeo 500HP', 
            'Mina Boroo, La Libertad', 
            1250.00, 
            'PENDIENTE', 
            u_operaciones_id, 
            CURRENT_DATE + 3
        ) RETURNING id INTO visita_id;

        INSERT INTO aprobaciones_gerencia (tipo, referencia_id, titulo, descripcion, monto, estado, solicitado_por)
        VALUES (
            'VISITA_TECNICA',
            visita_id,
            'Visita Técnica - Barcaza Boroo',
            'Solicitud de viáticos y costos de traslado para levantamiento técnico. Incluye pasajes terrestres, camioneta de escolta y alojamiento.',
            1250.00,
            'PENDIENTE',
            u_operaciones_id
        );

        -- B. MONTO DE COTIZACIÓN
        -- Actualizar presupuesto_config del plan a PENDIENTE_APROBACION
        UPDATE presupuesto_config 
        SET status = 'PENDIENTE_APROBACION' 
        WHERE plan_id = p_boroo_id
        RETURNING id INTO pc_id;

        IF pc_id IS NOT NULL THEN
            INSERT INTO aprobaciones_gerencia (tipo, referencia_id, titulo, descripcion, monto, estado, solicitado_por)
            VALUES (
                'COTIZACION',
                pc_id,
                'Aprobación de Propuesta - Barcaza Boroo',
                'Revisión final de costos unitarios (APU) y margen comercial para el servicio de ingeniería y montaje estructural de barcaza.',
                15800.00,
                'PENDIENTE',
                u_operaciones_id
            );
        END IF;
    END IF;

    -- C. PRÉSTAMO / COMPRA EXTRAORDINARIA
    IF u_logistica_id IS NOT NULL AND p_prodise_id IS NOT NULL AND prov_komatsu_id IS NOT NULL AND wh_id IS NOT NULL THEN
        -- Crear OC en estado PENDIENTE_APROBACION
        INSERT INTO ordenes_compra (code, proveedor_id, plan_id, status, solicitado_por, almacen_destino, total_estimado, notas)
        VALUES (
            'OC-EXTRA-001',
            prov_komatsu_id,
            p_prodise_id,
            'PENDIENTE_APROBACION',
            u_logistica_id,
            wh_id,
            3450.00,
            'Compra de cámaras y cable de red exterior por encima del presupuesto asignado para proyecto Prodise. Requiere préstamo aprobado por gerencia.'
        ) RETURNING id INTO oc_id;

        INSERT INTO aprobaciones_gerencia (tipo, referencia_id, titulo, descripcion, monto, estado, solicitado_por)
        VALUES (
            'PRESTAMO_COMPRA',
            oc_id,
            'Préstamo de Compra - Cámaras Prodise (OC-EXTRA-001)',
            'Solicitud de fondos extraordinarios para adquisición de suministros de seguridad. Justificación: Stock local agotado y sin saldo presupuestal.',
            3450.00,
            'PENDIENTE',
            u_logistica_id
        );
    END IF;
END $$;
