# Research & Design Decisions: Filtro por responsable en el export

**Phase 0** · Branch `001-export-filtro-responsable` · 2026-06-19

No quedaron `NEEDS CLARIFICATION` tras `/speckit-clarify`. Estas son las decisiones de diseño y su justificación, ancladas al código real verificado.

---

### D1 — Coincidir por **id** del responsable, reutilizando la semántica del tablero

- **Decisión**: Una tarea coincide si el id del responsable elegido está en `responsables_ids` (lista separada por comas) **o** es igual a `responsable_id`.
- **Rationale**: El tablero ya implementa exactamente esto en [AdminPlanificacion.jsx:819-821](../../frontend/myapp/src/pages/admin/AdminPlanificacion.jsx#L819-L821). Replicar la misma regla en el export garantiza que "lo que ves en pantalla filtrado" coincide con "lo que exportas". Cada actividad ya expone `responsable_id`, `responsables_ids` y `responsable` ([service.py:23-33](../../app/modules/planificacion/service.py#L23-L33)).
- **Alternativas rechazadas**: Filtrar por nombre/etiqueta (`responsable`) — frágil ante homónimos y renombrados de usuario; rompe si cambia el `username`.

### D2 — Selección **simple** (un responsable a la vez)

- **Decisión**: El filtro acepta un único id de responsable.
- **Rationale**: Confirmado en `/speckit-clarify`. Coherente con el filtro de columna del tablero (también simple). Menor complejidad de UI y de parámetros.
- **Alternativas rechazadas**: Multiselección — descartada explícitamente en clarify; añadiría manejo de listas en query y UI.

### D3 — Opción **"sin responsable asignado"** con sentinela `__none__`

- **Decisión**: El mismo parámetro `responsable` acepta el valor especial `__none__`, que devuelve solo las tareas sin ningún responsable (ni en `responsables_ids` ni en `responsable_id`).
- **Rationale**: Confirmado en clarify (FR-007). Un solo parámetro y un solo `<select>` cubren los tres casos (todos / una persona / sin asignar). Distinguir de la cadena vacía (= todos) evita ambigüedad.
- **Alternativas rechazadas**: Un segundo parámetro booleano `sin_responsable` — duplica superficie de API y obliga a validar combinaciones contradictorias (`responsable=X & sin_responsable=true`).

### D4 — Filtrado **en memoria** dentro del service

- **Decisión**: Añadir la condición de responsable en el bucle de filtrado de `export_planificacion_excel_service`, junto a prioridad/estado/cliente.
- **Rationale**: El export ya carga todas las actividades con `list_actividades_service()` y filtra en Python ([service.py:285-299](../../app/modules/planificacion/service.py#L285-L299)). Mantener el patrón es lo más simple y consistente; el volumen es bajo.
- **Alternativas rechazadas**: Empujar el filtro a SQL — el export actual no parametriza SQL por filtro; introducirlo solo para este caso rompería la simetría y agregaría complejidad sin beneficio medible.

### D5 — Nulos defensivos

- **Decisión**: Antes de `.split(",")`, normalizar con `(a.get("responsables_ids") or "")`; tratar `responsable_id` ausente como sin coincidencia.
- **Rationale**: Artículo 6 de la constitución. `responsables_ids` puede ser `None`. Evita `AttributeError`/`None.split`.
