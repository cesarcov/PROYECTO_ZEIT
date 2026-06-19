# API Contract: Export de actividades de Planificación

**Phase 1** · Branch `001-export-filtro-responsable` · 2026-06-19

## Endpoint (existente, se extiende)

```
GET /planificacion/actividades/export
```

- **Auth**: igual que hoy — depende de `_PLAN_ADMIN` (sin cambios de permiso).
- **Handler**: `export_actividades` en [planificacion/router.py:62](../../app/modules/planificacion/router.py#L62) → `export_planificacion_excel_service` en [service.py:272](../../app/modules/planificacion/service.py#L272).

## Query parameters

| Parámetro | Tipo | Estado | Descripción |
|---|---|---|---|
| `fecha_inicio` | string (YYYY-MM-DD) | existente | Límite inferior sobre `fecha_limite`/`fecha_solicitud`. |
| `fecha_fin` | string (YYYY-MM-DD) | existente | Límite superior. |
| `prioridad` | string | existente | Coincidencia exacta. |
| `estado` | string | existente | Coincidencia exacta. |
| `cliente` | string | existente | Coincidencia parcial (substring, case-insensitive). |
| **`responsable`** | **string** | **NUEVO** | Ver tabla de valores abajo. Opcional. |

### Valores de `responsable`

| Valor | Resultado |
|---|---|
| ausente / `""` | Todas las tareas (sin filtrar por responsable). **Comportamiento idéntico al actual.** |
| `<id de usuario>` | Solo tareas donde ese id está en `responsables_ids` o es el `responsable_id`. |
| `__none__` | Solo tareas sin ningún responsable asignado. |

Todos los filtros se combinan en **intersección**.

## Response

- **200 OK**
- `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- Cuerpo: archivo `.xlsx` con las **mismas columnas y formato actuales** (incluida la columna "Responsable"). Solo cambia el conjunto de filas.
- Si ninguna tarea coincide: archivo válido con solo la fila de título + cabeceras (sin filas de datos). **Nunca un error.**

## Ejemplos

```
GET /planificacion/actividades/export?responsable=2f3c...&estado=En%20Progreso
GET /planificacion/actividades/export?responsable=__none__
GET /planificacion/actividades/export            (todos — sin cambios)
```

## Contrato Frontend ↔ Backend

- El frontend envía el **id de usuario** tal cual aparece en la lista `users` (la misma que llena el filtro de columna del tablero).
- El valor especial `__none__` lo produce la opción "Sin responsable asignado" del `<select>` del modal de export.
- `buildExportParams` añade `responsable` solo si tiene valor (no se envía cuando es "todos").
