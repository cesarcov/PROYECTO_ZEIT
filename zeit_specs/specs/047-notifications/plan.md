# F-047 — plan.md (diseño técnico)

## Emisor único

Un solo punto de emisión que los demás módulos llaman **dentro de su
transacción de negocio**: si el negocio hace rollback, la notificación también.

```python
# app/modules/notifications/emitter.py

def emit(conn, *, company_id: int, event_type: str,
         entity_type: str, entity_id: int,
         title: str, body: str = "",
         required_permission: str) -> int:
    """Crea notificaciones para todos los usuarios de la empresa que tengan
    el permiso indicado (RN-03). Devuelve cuántas creó. Se llama DENTRO de la
    transacción del evento de negocio."""
    users = queries.users_with_permission(conn, company_id, required_permission)
    n = 0
    for uid in users:
        n += queries.insert_notification_dedup(
            conn, company_id=company_id, user_id=uid,
            event_type=event_type, entity_type=entity_type,
            entity_id=entity_id, title=title, body=body)
    return n
```

Ejemplo de uso desde `finance/service.py` (tarea T-08 de F-046):

```python
emit(conn, company_id=cid, event_type="APPROVAL_PENDING",
     entity_type="payment", entity_id=pay_id,
     title=f"Pago de {fmt(amount)} requiere aprobacion",
     required_permission="finance:approve_payments")
```

## Polling in-app (decisión: NO WebSockets)

- El frontend hace `GET /api/v1/notifications/unread-count` cada 25 s (con
  TanStack Query e `refetchInterval`). Barato y cacheable.
- Al abrir la campana: `GET /api/v1/notifications?limit=20`.
- Deep-link derivado de `(entity_type, entity_id)` en el frontend (RN-01), no
  guardado como URL.

## Digest de correo

Job programado (`.github/workflows/digest.yml`, cron cada hora, o worker en
Render) que agrupa no-leídas con `email=true` por usuario y envía UN correo
resumen vía proveedor transaccional con tier gratuito (Resend/Brevo).

## Detección de cruce de umbral (CA-3.1)

El hook de stock mínimo se dispara **solo cuando el movimiento cruza** de
"sobre mínimo" a "bajo mínimo" (comparar stock antes vs después del movimiento),
no en cada movimiento posterior. La dedupe diaria (RN-02) es la segunda barrera
anti-spam.
