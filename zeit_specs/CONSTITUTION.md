# CONSTITUTION.md — Reglas de oro de ZEIT Solutions ERP

> Este archivo es la fuente de verdad del proceso. Cualquier sesión de desarrollo
> (humano o Claude Code) **empieza leyendo este archivo**. Las reglas están
> versionadas: cambiarlas requiere un commit explícito que las modifique aquí.

## Reglas técnicas (ya vigentes)

1. **Todo SQL vive en la capa de datos.** El `router.py` solo valida entrada,
   autoriza (RBAC) y delega. El `service.py` contiene reglas de negocio. El
   `queries.py` contiene SQL puro. Ningún SQL en routers.

2. **Los colores van en variables CSS** (`var(--primary)`, `var(--accent)`,
   `var(--action)`, `var(--text-muted)`). Nunca hex fijos en componentes.

3. **Cada cambio de esquema es una migración `.sql` numerada nueva.** Nunca se
   edita una migración ya aplicada en ningún entorno. Los arreglos son una
   migración nueva.

4. **La seguridad se valida en el backend.** El frontend solo muestra u oculta.
   Un `PermissionGate` que oculta un botón NO sustituye la validación del endpoint.

## Reglas nuevas (este plan las formaliza)

5. **Sin spec no hay código; sin test no hay merge.** Ninguna feature se
   implementa sin una `spec.md` aprobada. Ningún PR se mergea con el CI en rojo.

6. **Ningún secreto en el repositorio ni en la documentación.** Solo en el gestor
   de secretos del entorno (Render / Vercel / GitHub Actions secrets). Ni en
   archivos `.md`, ni en ejemplos, ni en el historial de git.

7. **Todo endpoint nuevo declara su permiso RBAC explícito.** No existen
   endpoints "abiertos por defecto" (deny-by-default). Un endpoint sin permiso
   declarado es un bug que el CI debe detectar.

8. **Toda acción de escritura relevante genera evento de auditoría** (con
   `before/after` cuando aplique).

## El ciclo SDD (speckit) — 5 etapas

```
/speckit-specify   → spec.md          (QUÉ queremos y por qué)
/speckit-plan      → plan.md + data-model.md + contracts/  (CÓMO)
/speckit-tasks     → tasks.md         (PASOS ejecutables, < 1 sesión c/u)
/speckit-implement → código + tests   (EJECUTAR)
/speckit-verify    → checklist marcado (VALIDAR — etapa nueva propuesta)
```

**Regla de la quinta etapa:** ninguna feature está TERMINADA hasta que
(1) cada criterio de aceptación de la spec tenga un test automatizado que lo
nombre, (2) el checklist de verificación esté marcado con evidencia, y (3) la
spec se actualice con lo que cambió durante la implementación.

## Definition of Done de una feature

- [ ] La spec está en estado IMPLEMENTADA y refleja lo realmente construido.
- [ ] Cada criterio de aceptación (CA-x.y) tiene un test en verde que lo nombra.
- [ ] La matriz RBAC incluye los permisos nuevos y `test_rbac_matrix` pasa.
- [ ] Las acciones de escritura generan auditoría (verificado por test).
- [ ] La migración corrió en **staging antes que en producción**.
- [ ] Sentry no muestra errores nuevos atribuibles a la feature tras 48 h.
- [ ] El `.md` de alcance del proyecto fue actualizado.

## Checklist de cada sesión con Claude Code

- [ ] Leer este `CONSTITUTION.md` y la spec activa antes de escribir código.
- [ ] Confirmar en qué tarea (T-XX) se trabaja y que sus dependencias están hechas.
- [ ] Correr la suite local antes y después de los cambios.
- [ ] Ningún secreto en el diff (revisión explícita antes del commit).
- [ ] Commit con referencia a la tarea:
      `feat(finance): T-04 registrar pago (RN-01, RN-02)`.
- [ ] Marcar la tarea en `tasks.md` con evidencia (nombre del test o captura).

## Convención de migraciones reservadas

Cada spec reserva su número de migración para evitar colisiones entre features
que se desarrollan en paralelo:

| Spec | Migración | Estado |
|---|---|---|
| F-045b Stock mínimo | 045b | Ejemplo de referencia |
| F-046 Finance | 046 | Planificada |
| F-047 Notificaciones | 047 | Planificada |
| F-048 Facturación SUNAT | 048 | Planificada |
| F-049 Multi-tenancy | 049 | Planificada |
