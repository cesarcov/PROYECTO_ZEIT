-- Migración 026: Columna assigned_to en solicitudes del canal y actualización de la estructura organizacional real
ALTER TABLE canal_solicitudes ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;

-- 1. Actualizar nombres de usuario en la tabla users
UPDATE users SET username = 'frank_sonco' WHERE username = 'gerente_general';
UPDATE users SET username = 'juliet_alvis' WHERE username = 'administracion';
UPDATE users SET username = 'yasmyn_machuca' WHERE username = 'asistente_admin1';
UPDATE users SET username = 'wilfredo_flores' WHERE username = 'operaciones';
UPDATE users SET username = 'cesar_huamani' WHERE username = 'logistica';
UPDATE users SET username = 'tiburoncito_junior' WHERE username = 'coordinador_logistica1';
UPDATE users SET username = 'lagartija_segura' WHERE username = 'El inge';
UPDATE users SET username = 'felipe_choque' WHERE username = 'ingeniero_operaciones1';

-- Desactivar usuarios demo no pertenecientes a la estructura organizacional principal
UPDATE users SET is_active = FALSE WHERE username IN (
    'asistente_admin2', 'ingeniero_operaciones2', 'operador_logistica1', 'supervisor_operaciones1'
);

-- 2. Limpiar roles de los usuarios activos para re-asignar
DELETE FROM user_roles WHERE user_id IN (
    SELECT id FROM users WHERE username IN (
        'admin', 'frank_sonco', 'juliet_alvis', 'yasmyn_machuca', 
        'wilfredo_flores', 'cesar_huamani', 'tiburoncito_junior', 
        'lagartija_segura', 'felipe_choque'
    )
);

-- 3. Insertar nuevos roles empresariales reales
-- Admin Maestro (TI - Ceshark)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'admin' AND r.name = 'Administrador Maestro';

-- Gerente General (Frank Sonco)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'frank_sonco' AND r.name = 'Gerente General';

-- Administradora (Juliet Alvis)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'juliet_alvis' AND r.name = 'Administrador General';

-- Asistente de Administración (Yasmyn Machuca)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'yasmyn_machuca' AND r.name = 'Asistente Administrativo';

-- Jefe de Operaciones (Wilfredo Flores)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'wilfredo_flores' AND r.name = 'Supervisor de Operaciones';

-- Ingeniero de servicios Junior y Jefe de Logística (Cesar Huamani)
-- Ojo: tiene dos roles (Operaciones y Logística)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'cesar_huamani' AND r.name IN ('Ingeniero de Campo', 'Coordinador Logístico');

-- Técnico de Servicios (Felipe Choque)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'felipe_choque' AND r.name = 'Ingeniero de Campo';

-- Ingeniero de Seguridad (Lagartija segura)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'lagartija_segura' AND r.name = 'Ingeniero de Campo';

-- Asistente de Logística (Tiburoncito Junior)
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'tiburoncito_junior' AND r.name = 'Operador Logístico';
