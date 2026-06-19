CREATE TABLE IF NOT EXISTS cliente_contactos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cliente_id UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
    nombre VARCHAR(255) NOT NULL,
    cargo VARCHAR(255),
    telefono VARCHAR(255),
    email VARCHAR(255),
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migrate existing primary contacts to the new contacts table if they don't exist yet
INSERT INTO cliente_contactos (cliente_id, nombre, cargo, telefono, email)
SELECT id, contacto, cargo_contacto, telefono, email
FROM clientes
WHERE contacto IS NOT NULL AND contacto <> ''
  AND NOT EXISTS (
      SELECT 1 FROM cliente_contactos 
      WHERE cliente_contactos.cliente_id = clientes.id 
        AND cliente_contactos.nombre = clientes.contacto
  );
