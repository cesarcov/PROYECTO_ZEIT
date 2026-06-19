# Data Model: Filtro por responsable en el export

**Phase 1** · Branch `001-export-filtro-responsable` · 2026-06-19

> **No hay entidades nuevas ni migraciones.** Esta feature solo lee datos ya existentes.

## Entidades involucradas (existentes)

### Tarea de Planificación — tabla `planificacion_semanal`

| Campo | Tipo | Rol en esta feature |
|---|---|---|
| `responsable_id` | uuid → `users.id` (nullable) | Responsable principal/legacy (modelo de un solo responsable). |
| `responsables_ids` | text (nullable), uuids separados por comas | Múltiples responsables (migración 032). Fuente principal de coincidencia. |
| `prioridad`, `estado`, `cliente`, `fecha_solicitud`, `fecha_limite` | — | Filtros ya existentes (sin cambios). |

### Representación en memoria (lo que devuelve `_row_to_actividad`)

Cada actividad es un dict con (verificado en [service.py:23-33](../../app/modules/planificacion/service.py#L23-L33)):

- `responsable_id`: `str | None`
- `responsables_ids`: `str | None` (ej. `"uuid1,uuid2"`)
- `responsable`: `str | None` (etiqueta legible, usada solo para mostrar en el Excel)

### Usuario — tabla `users`

- `id`, `username`. Alimenta el `<select>` de responsables tanto en el tablero como (nuevo) en el modal de export. Se muestra con `formatUsername(username)`.

## Regla de coincidencia (canónica)

Parámetro de entrada: `responsable` (string opcional).

```
sea R = responsable (parámetro)
para cada actividad A:
    ids = [x.strip() for x in (A.responsables_ids or "").split(",") if x.strip()]
    tiene_responsable = bool(ids) or bool(A.responsable_id)

    si R es vacío/ausente:        -> incluir A         (todos, sin cambio)
    si R == "__none__":           -> incluir A solo si NOT tiene_responsable
    en otro caso (R = un id):     -> incluir A solo si R in ids  OR  A.responsable_id == R
```

La condición se aplica **en intersección** con los filtros de fecha/prioridad/estado/cliente ya existentes (todas deben cumplirse).

## Valores del parámetro `responsable`

| Valor | Significado |
|---|---|
| (ausente o `""`) | Todas las tareas (comportamiento actual). |
| `<id de usuario>` | Tareas donde esa persona es responsable (principal o uno de varios). |
| `__none__` | Tareas sin ningún responsable asignado. |
