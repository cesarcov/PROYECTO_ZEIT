# Data Model: Solicitudes Multi-Item con Trazabilidad

**Feature**: 006-solicitudes-multi-material | **Date**: 2026-06-24

---

## Entidades

### material_requests (existente — se extiende, sin cambios de esquema)

Cabecera de la solicitud. Con esta feature actúa como "header" del pedido.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | — |
| requested_by | UUID FK → users | quien crea la solicitud |
| project_id | UUID FK → projects | proyecto al que aplica |
| related_material_id | UUID FK → materials | legacy single-item; en multi-item = primer ítem |
| quantity | NUMERIC | legacy; en multi-item = cantidad del primer ítem |
| reason | TEXT | motivo de la solicitud |
| status | ENUM | PENDING → APPROVED o REJECTED |
| priority | TEXT | MEDIUM por defecto |
| sla_due_at | TIMESTAMP | +72h desde creación |
| approved_by | UUID FK → users | quien aprobó |
| approved_at | TIMESTAMP | — |
| rejected_at | TIMESTAMP | — |
| source | TEXT | 'MANUAL' (por defecto) |

**Invariante de compatibilidad**: `related_material_id` siempre se llena (con el material del primer ítem) para no romper queries legacy.

---

### material_request_items (existente — se activa)

Items de detalle de una solicitud multi-material.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | gen_random_uuid() |
| request_id | UUID FK → material_requests | — |
| material_id | UUID FK → materials | material solicitado |
| quantity | NUMERIC NOT NULL | cantidad solicitada (> 0) |

**Reglas de negocio**:
- Una solicitud DEBE tener al menos 1 ítem.
- No puede haber dos ítems con el mismo `material_id` en la misma solicitud.
- `quantity` debe ser estrictamente positiva.

**Relación con material_requests**: 1 solicitud → N ítems (mínimo 1).

---

### material_request_audit (existente — se activa)

Registro inmutable de cada cambio de estado. Solo INSERT, nunca UPDATE ni DELETE.

| Campo | Tipo | Notas |
|-------|------|-------|
| id | UUID PK | gen_random_uuid() |
| material_request_id | UUID FK → material_requests | — |
| action | TEXT NOT NULL | 'APPROVED' o 'REJECTED' |
| old_status | TEXT | estado antes del cambio |
| new_status | TEXT | estado después del cambio |
| actor_id | UUID | usuario que hizo el cambio |
| source | TEXT | DEFAULT 'API' |
| created_at | TIMESTAMP NOT NULL | DEFAULT now() |

**Invariante**: Se inserta en la misma transacción que el cambio de estado en `material_requests`. Nunca queda desincronizado.

---

## Flujo de estados de una solicitud

```
[Creación]
    ↓
PENDING  ──→  APPROVED  (solo logística con permiso logistics:stock:move)
         ↘
          REJECTED  (solo logística con permiso logistics:stock:move)
```

Cada transición genera 1 fila en `material_request_audit`.

---

## Esquema de entrada (Pydantic)

### MaterialRequestItemCreate (nuevo)
```
material_id: UUID        # material a solicitar
quantity:    float > 0   # cantidad
```

### MaterialRequestCreate (extendido, compatible)
```
# Modo multi-item (nuevo):
items:                List[MaterialRequestItemCreate]  # 1..N ítems
reason:               str
project_id:           UUID

# Modo legacy (backward compat — se mantiene):
related_material_id:  UUID    (Optional)
quantity:             float   (Optional)
reason:               str
project_id:           UUID
```

**Regla de modo**: si `items` tiene contenido → modo multi-item. Si no → modo legacy (related_material_id + quantity obligatorios).

---

## Esquema de salida (respuesta de API)

### MaterialRequestOut (extendido)
```
id:                UUID
status:            str
reason:            str
priority:          str
project_id:        UUID
project_name:      str
requested_by:      str
created_at:        datetime
sla_due_at:        datetime
approved_by:       UUID | null
approved_at:       datetime | null
rejected_at:       datetime | null

# Items (siempre presente):
items: [
  {
    material_id:   UUID
    material_name: str
    material_code: str
    quantity:      float
  }
]
```

### MaterialRequestAuditOut (nuevo)
```
id:           UUID
action:       str          # 'APPROVED' | 'REJECTED'
old_status:   str
new_status:   str
actor_name:   str          # username del actor
source:       str
created_at:   datetime
```
