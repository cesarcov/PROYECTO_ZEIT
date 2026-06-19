-- ============================================================
-- CeShark ERP — Migration 028
-- Reasignar tareas de usuarios desactivados a sus reemplazos activos
-- operador_logistica1   → tiburoncito_junior  (mismo rol: Operador Logístico)
-- supervisor_operaciones1 → wilfredo_flores   (mismo rol: Supervisor de Operaciones)
-- asistente_admin2      → yasmyn_machuca      (mismo rol: Asistente Administrativo)
-- ingeniero_operaciones2 → felipe_choque      (mismo rol: Ingeniero de Campo)
-- ============================================================

-- Responsable: operador_logistica1 → tiburoncito_junior
UPDATE planificacion_semanal
SET responsable_id = (SELECT id FROM users WHERE username = 'tiburoncito_junior')
WHERE responsable_id = (SELECT id FROM users WHERE username = 'operador_logistica1');

-- Responsable: supervisor_operaciones1 → wilfredo_flores
UPDATE planificacion_semanal
SET responsable_id = (SELECT id FROM users WHERE username = 'wilfredo_flores')
WHERE responsable_id = (SELECT id FROM users WHERE username = 'supervisor_operaciones1');

-- Responsable: asistente_admin2 → yasmyn_machuca
UPDATE planificacion_semanal
SET responsable_id = (SELECT id FROM users WHERE username = 'asistente_admin2')
WHERE responsable_id = (SELECT id FROM users WHERE username = 'yasmyn_machuca');

-- Responsable: ingeniero_operaciones2 → felipe_choque
UPDATE planificacion_semanal
SET responsable_id = (SELECT id FROM users WHERE username = 'felipe_choque')
WHERE responsable_id = (SELECT id FROM users WHERE username = 'ingeniero_operaciones2');

-- Seguimiento: supervisor_operaciones1 → wilfredo_flores
UPDATE planificacion_semanal
SET seguimiento_id = (SELECT id FROM users WHERE username = 'wilfredo_flores')
WHERE seguimiento_id = (SELECT id FROM users WHERE username = 'supervisor_operaciones1');

-- Seguimiento: asistente_admin2 → yasmyn_machuca
UPDATE planificacion_semanal
SET seguimiento_id = (SELECT id FROM users WHERE username = 'yasmyn_machuca')
WHERE seguimiento_id = (SELECT id FROM users WHERE username = 'asistente_admin2');

-- Seguimiento: operador_logistica1 → tiburoncito_junior
UPDATE planificacion_semanal
SET seguimiento_id = (SELECT id FROM users WHERE username = 'tiburoncito_junior')
WHERE seguimiento_id = (SELECT id FROM users WHERE username = 'operador_logistica1');

-- Seguimiento: ingeniero_operaciones2 → felipe_choque
UPDATE planificacion_semanal
SET seguimiento_id = (SELECT id FROM users WHERE username = 'felipe_choque')
WHERE seguimiento_id = (SELECT id FROM users WHERE username = 'ingeniero_operaciones2');

-- Verificación final
SELECT
    ur.username as responsable,
    us.username as seguimiento,
    COUNT(*) as tareas
FROM planificacion_semanal ps
LEFT JOIN users ur ON ur.id = ps.responsable_id
LEFT JOIN users us ON us.id = ps.seguimiento_id
GROUP BY ur.username, us.username
ORDER BY ur.username;
