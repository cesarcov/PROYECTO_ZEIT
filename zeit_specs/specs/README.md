# specs/ — Especificaciones Spec-Driven de ZEIT ERP

Cada carpeta es una funcionalidad especificada **antes** de codearse, siguiendo
el flujo `/speckit-specify → plan → tasks → implement → verify`.

## Orden de ejecución recomendado

```
000-fase-0-endurecimiento   ← PRIMERO. No es una feature: es pagar deuda técnica
                              (tests, CI, secretos, backups, storage persistente).
045b-min-stock              ← Ejemplo guiado COMPLETO de referencia (ya con código).
                              Úsalo como plantilla mental para todo lo demás.
046-finance                 ← Fase 1. Cierra el ciclo del dinero. Base de F-048.
047-notifications           ← Fase 2. Infra transversal. Consume min-stock (045b).
049-multitenancy            ← Fase 3. Aislamiento formal por empresa (RLS).
048-cpe-sunat               ← Fase 4. Facturación electrónica. Depende de 046.
```

## Cómo usar cada spec con Claude Code

1. Abre la carpeta de la feature y lee `spec.md` completo.
2. Lee `plan.md`, `data-model.md` y `contracts/api.md`.
3. Abre `tasks.md` y ejecuta las tareas **en orden de dependencia**, una por vez.
4. Al terminar, marca el checklist de verificación al final de `spec.md`.

## Estado del template

La plantilla oficial está en `_template/spec.md`. Toda spec nueva se crea
copiándola. Ver `../CONSTITUTION.md` para las reglas del proceso.
