-- Datos de demostración para el entorno de STAGING — F-000 / T-15.
--
-- Se aplica DESPUÉS de las migraciones, sobre la base de datos de staging:
--
--     DATABASE_URL=<url-de-staging> python run_migrations.py
--     psql "<url-de-staging>" -f seed/demo.sql
--     DATABASE_URL=<url-de-staging> TEST_USER=... TEST_PASSWORD=... \
--         python scripts/seed_ci_users.py
--
-- NUNCA se ejecuta contra producción: el guardarraíl de abajo aborta si
-- detecta datos reales.
--
-- Este archivo NO contiene contraseñas: los usuarios los crea
-- `scripts/seed_ci_users.py`, que las lee del entorno (regla 6).

\set ON_ERROR_STOP on

-- ── Guardarraíl ──────────────────────────────────────────────────────────────
-- Si la base ya tiene un volumen de datos propio de producción, no se toca.
DO $$
DECLARE
    total_materiales INT;
BEGIN
    SELECT count(*) INTO total_materiales FROM materials;
    IF total_materiales > 500 THEN
        RAISE EXCEPTION
            'ABORTADO: esta base tiene % materiales; parece PRODUCCIÓN, no staging.',
            total_materiales;
    END IF;
END $$;

BEGIN;

-- ── Clientes de demostración ─────────────────────────────────────────────────
INSERT INTO clientes (codigo, razon_social, ruc, direccion, telefono, email)
VALUES
    ('DEMO-CLI-001', 'DEMO Minera Andina S.A.C.',   '20100000001', 'Av. Demo 100, Lima',     '01-5550001', 'contacto@demo-andina.test'),
    ('DEMO-CLI-002', 'DEMO Constructora Pacífico',  '20100000002', 'Av. Demo 200, Arequipa', '054-555002', 'contacto@demo-pacifico.test'),
    ('DEMO-CLI-003', 'DEMO Agroindustrias del Sur', '20100000003', 'Av. Demo 300, Ica',      '056-555003', 'contacto@demo-agro.test')
ON CONFLICT DO NOTHING;

-- ── Almacenes de demostración ────────────────────────────────────────────────
INSERT INTO warehouses (name, location)
VALUES
    ('DEMO Almacén Central', 'Lima'),
    ('DEMO Almacén Obra',    'Arequipa')
ON CONFLICT DO NOTHING;

-- ── Materiales de demostración ───────────────────────────────────────────────
INSERT INTO materials (code, name, unit, category)
VALUES
    ('DEMO-001', 'Abrazadera demo 1/2"',   'UND', 'Ferretería'),
    ('DEMO-002', 'Tubería demo PVC 4"',    'ML',  'Tubería'),
    ('DEMO-003', 'Cable demo THW 12 AWG',  'ML',  'Eléctrico'),
    ('DEMO-004', 'Perno demo hexagonal',   'UND', 'Ferretería'),
    ('DEMO-005', 'Pintura demo epóxica',   'GLN', 'Acabados')
ON CONFLICT (code) DO NOTHING;

COMMIT;

-- Resumen de lo sembrado.
SELECT
    (SELECT count(*) FROM clientes   WHERE razon_social LIKE 'DEMO %') AS clientes_demo,
    (SELECT count(*) FROM warehouses WHERE name         LIKE 'DEMO %') AS almacenes_demo,
    (SELECT count(*) FROM materials  WHERE code         LIKE 'DEMO-%') AS materiales_demo;
