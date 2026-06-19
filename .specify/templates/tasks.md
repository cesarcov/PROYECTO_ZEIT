# Lista de Tareas (Tasks)

Este checklist detalla las tareas secuenciales para la implementación. Marca el progreso utilizando `[ ]` para pendiente, `[/]` para en proceso y `[x]` para completado.

---

## Fase 1: Base de Datos y Backend (Database & Backend)
*   [ ] Crear script de migración SQL en `migrations/` si corresponde.
*   [ ] Ejecutar `run_migrations.py` y validar la estructura de las tablas en PostgreSQL.
*   [ ] Definir esquemas Pydantic en `schemas.py`.
*   [ ] Escribir lógica SQL y funciones de negocio en `service.py`.
*   [ ] Exponer endpoints en `router.py` y verificar autenticación/scopes.
*   [ ] Probar endpoints de forma local (ej. a través de Swagger `/docs`).

## Fase 2: Frontend e Integración (Frontend & Integration)
*   [ ] Crear o modificar componentes visuales en `frontend/myapp/src/pages/` o `components/`.
*   [ ] Conectar llamadas a la API usando la URL base correcta y el token de `localStorage`.
*   [ ] Integrar nuevas rutas protegidas por rol en `App.jsx` y accesos en `Layout.jsx`.
*   [ ] Aplicar estilos inline utilizando objetos JS o utilidades Tailwind según la Constitución.

## Fase 3: Validación y Pruebas (Verification)
*   [ ] Verificar compilación limpia del frontend (`npm run build`).
*   [ ] Validar que no haya regresiones en funcionalidades existentes del ERP.
*   [ ] Confirmar el registro correcto de auditoría en la BD de auditoría tras realizar inserciones o modificaciones.
