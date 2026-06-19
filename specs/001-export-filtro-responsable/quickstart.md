# Quickstart — Validación: Filtro por responsable en el export

**Phase 1** · Branch `001-export-filtro-responsable` · 2026-06-19

Guía para comprobar, de punta a punta, que la feature funciona. (Los detalles de implementación van en `tasks.md`.)

## Prerrequisitos

- Backend levantado: `venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Frontend levantado: `npm --prefix frontend/myapp run dev`
- Sesión iniciada con un rol con acceso a Planificación.
- Datos de prueba: al menos una tarea con un responsable, una tarea con **dos** responsables, y una tarea **sin** responsable.

## Escenarios de aceptación

### E1 — Filtrar por una persona (US1, FR-002)
1. En Planificación, abrir **Exportar Excel**.
2. En el nuevo selector **Responsable**, elegir a una persona "X".
3. Descargar. **Esperado**: el Excel contiene solo tareas donde X es responsable.

### E2 — Tarea con varios responsables (US2, FR-005)
1. Existe una tarea asignada a X e Y.
2. Exportar filtrando por **Y**. **Esperado**: esa tarea aparece.
3. Exportar filtrando por una persona Z que no está en la tarea. **Esperado**: la tarea NO aparece.

### E3 — Sin responsable asignado (US3, FR-007)
1. En el selector elegir **"Sin responsable asignado"**.
2. Descargar. **Esperado**: solo tareas sin ningún responsable.

### E4 — Sin filtro = sin regresión (FR-004)
1. Dejar el selector en **"Todos"**.
2. Exportar. **Esperado**: contenido idéntico al export actual con los mismos otros filtros.

### E5 — Combinación de filtros (FR-003)
1. Elegir responsable X **y** estado "En Progreso".
2. **Esperado**: solo tareas de X en estado En Progreso (intersección).

### E6 — Sin coincidencias (SC-004 / edge)
1. Elegir un responsable sin tareas (o combinación imposible).
2. **Esperado**: archivo `.xlsx` válido con solo cabeceras; sin error.

## Validación rápida por API (sin UI)

```bash
# Reemplazar <TOKEN> y <USER_ID>
curl -s -o out.xlsx -w "%{http_code}\n" \
  "http://127.0.0.1:8000/planificacion/actividades/export?responsable=<USER_ID>" \
  -H "Authorization: Bearer <TOKEN>"      # espera 200

curl -s -o none.xlsx -w "%{http_code}\n" \
  "http://127.0.0.1:8000/planificacion/actividades/export?responsable=__none__" \
  -H "Authorization: Bearer <TOKEN>"      # espera 200
```

## Compuerta (obligatoria antes de cerrar)

```powershell
.\verify.ps1   # import backend + pytest tests/smoke + npm run build → "TODO VERDE"
```
