# API Contracts: Solicitudes Multi-Item con Trazabilidad

**Feature**: 006-solicitudes-multi-material | **Date**: 2026-06-24

Auth requerida en todos los endpoints salvo indicación. Prefijo: `/requests`

---

## Endpoints modificados

### POST /requests/material-requests
Crear solicitud de material. **Se extiende para soportar múltiples ítems.**

**Auth**: cualquier usuario autenticado.

**Request body (modo multi-item — nuevo):**
```json
{
  "items": [
    { "material_id": "uuid", "quantity": 5 },
    { "material_id": "uuid", "quantity": 2 }
  ],
  "reason": "Necesario para obra en Mina Boroo",
  "project_id": "uuid"
}
```

**Request body (modo legacy — sin cambios):**
```json
{
  "related_material_id": "uuid",
  "quantity": 3,
  "reason": "Necesario para obra en Mina Boroo",
  "project_id": "uuid"
}
```

**Response 200:**
```json
{
  "id": "uuid",
  "status": "PENDING",
  "sla_due_at": "2026-06-27T15:00:00"
}
```

**Errores:**
- `422` — items vacíos, cantidad <= 0, material_id duplicado, material inexistente.
- `422` — modo legacy sin `related_material_id` o `quantity`.

---

### GET /requests/material-requests/my
Lista las solicitudes del usuario autenticado. **Se extiende para incluir items.**

**Auth**: cualquier usuario autenticado.

**Response 200 (fragmento de un ítem):**
```json
[
  {
    "id": "uuid",
    "status": "PENDING",
    "reason": "Necesario para obra",
    "priority": "MEDIUM",
    "project_id": "uuid",
    "project_name": "Barcaza 500HP",
    "created_at": "2026-06-24T15:00:00",
    "sla_due_at": "2026-06-27T15:00:00",
    "approved_by": null,
    "approved_at": null,
    "items": [
      {
        "material_id": "uuid",
        "material_name": "Cable de acero 1/2\"",
        "material_code": "MAT-001",
        "quantity": 5.0
      }
    ]
  }
]
```

---

### GET /requests/material-requests
Lista todas las solicitudes (logística). **Se extiende para incluir items.**

**Auth**: permiso `logistics:stock:move`.

Mismo formato de respuesta que el endpoint anterior.

---

## Endpoints nuevos

### GET /requests/material-requests/{request_id}/history
Consultar el historial de auditoría de una solicitud.

**Auth**: solicitante original (own request) O usuario con `logistics:stock:move`.

**Path param**: `request_id` — UUID de la solicitud.

**Response 200:**
```json
[
  {
    "id": "uuid",
    "action": "APPROVED",
    "old_status": "PENDING",
    "new_status": "APPROVED",
    "actor_name": "jose_guerrero",
    "source": "API",
    "created_at": "2026-06-24T16:30:00"
  }
]
```

**Response 200 (sin historial aún):** `[]`

**Errores:**
- `404` — solicitud no encontrada.
- `403` — usuario sin permisos para ver esta solicitud.

---

## Endpoints sin cambios

Los siguientes endpoints **no se modifican** en esta feature:

- `POST /requests/material-requests/{id}/approve` — mismo comportamiento externo; internamente ahora registra audit.
- `POST /requests/material-requests/{id}/reject` — ídem.
- `GET /requests/material-requests/operational` — sin cambios.
- Todo el grupo de reservas (`/reservations/*`) — sin cambios.
