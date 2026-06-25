# Quickstart / Guía de Validación: Solicitudes Multi-Item

**Feature**: 006-solicitudes-multi-material | **Date**: 2026-06-24

---

## Prerequisitos

- Backend corriendo en `http://127.0.0.1:8000`
- Usuario `juliet_alvis` (técnico) y usuario `admin` (logística) disponibles
- Al menos 2 materiales en la tabla `materials`

---

## Escenario 1 — Crear solicitud multi-item (US1 / P1)

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -d "username=juliet_alvis&password=123456" | jq -r .access_token)

# 2. Obtener 2 UUIDs de materiales existentes
curl -s http://127.0.0.1:8000/logistics/materials?limit=2 \
  -H "Authorization: Bearer $TOKEN" | jq '.[].id'
# → "uuid-mat-1" y "uuid-mat-2"

# 3. Crear solicitud con 2 materiales
curl -s -X POST http://127.0.0.1:8000/requests/material-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"material_id": "uuid-mat-1", "quantity": 3},
      {"material_id": "uuid-mat-2", "quantity": 1}
    ],
    "reason": "Prueba de multi-item",
    "project_id": "uuid-proyecto"
  }'
```

**Resultado esperado:**
```json
{"id": "uuid-nueva-solicitud", "status": "PENDING", "sla_due_at": "..."}
```

**Verificación:** Consultar `GET /requests/material-requests/my` y comprobar que el objeto devuelto tiene `"items"` con 2 entradas.

---

## Escenario 2 — Validación de duplicados (Edge Case)

```bash
curl -s -X POST http://127.0.0.1:8000/requests/material-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"material_id": "uuid-mat-1", "quantity": 3},
      {"material_id": "uuid-mat-1", "quantity": 2}
    ],
    "reason": "Duplicado intencional",
    "project_id": "uuid-proyecto"
  }'
```

**Resultado esperado:** `422 Unprocessable Entity` con mensaje sobre material duplicado.

---

## Escenario 3 — Aprobar y verificar audit trail (US2 / P2)

```bash
# 1. Login como admin
ADMIN_TOKEN=$(curl -s -X POST http://127.0.0.1:8000/auth/login \
  -d "username=admin&password=admin123" | jq -r .access_token)

# 2. Aprobar la solicitud creada en Escenario 1
REQUEST_ID="uuid-nueva-solicitud"
curl -s -X POST "http://127.0.0.1:8000/requests/material-requests/$REQUEST_ID/approve" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Resultado esperado:** `{"id": "uuid", "status": "APPROVED"}`

---

## Escenario 4 — Consultar historial de auditoría (US3 / P3)

```bash
curl -s "http://127.0.0.1:8000/requests/material-requests/$REQUEST_ID/history" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

**Resultado esperado:**
```json
[
  {
    "action": "APPROVED",
    "old_status": "PENDING",
    "new_status": "APPROVED",
    "actor_name": "admin",
    "source": "API",
    "created_at": "2026-06-24T..."
  }
]
```

---

## Escenario 5 — Compatibilidad backward (SC-003)

```bash
# Crear solicitud con modo legacy (un solo material)
curl -s -X POST http://127.0.0.1:8000/requests/material-requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "related_material_id": "uuid-mat-1",
    "quantity": 5,
    "reason": "Modo legacy sin cambios",
    "project_id": "uuid-proyecto"
  }'
```

**Resultado esperado:** Mismo comportamiento que antes de la feature. `200 OK` con `{"id": "...", "status": "PENDING"}`.

---

## Smoke Test automático

```bash
cd d:/PROYECTOS/ERP_MODULO/erp-modular
python -m pytest tests/smoke/ -v -k "multi_item or audit" --no-header
```

Deben pasar los tests nuevos y los 13 existentes sin ninguna modificación.

---

## Compuerta final

```powershell
.\verify.ps1
```

Los 3 pasos deben pasar: import backend + pytest smoke + npm build.
