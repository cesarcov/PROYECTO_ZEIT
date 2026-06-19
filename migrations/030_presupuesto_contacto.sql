-- Add column contacto_id to presupuesto_config
ALTER TABLE presupuesto_config ADD COLUMN IF NOT EXISTS contacto_id UUID REFERENCES cliente_contactos(id) ON DELETE SET NULL;

-- Migrate existing contacts based on matching client_id and contact name if possible
UPDATE presupuesto_config pc
SET contacto_id = cc.id
FROM cliente_contactos cc
WHERE pc.cliente_id = cc.cliente_id AND cc.nombre = (
    SELECT contacto FROM clientes c WHERE c.id = pc.cliente_id
) AND pc.contacto_id IS NULL;
