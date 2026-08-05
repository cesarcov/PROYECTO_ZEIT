# F-047 — data-model.md (migración 047)

```sql
-- migrations/047_notifications.sql

CREATE TABLE notifications (
    id           BIGSERIAL PRIMARY KEY,
    company_id   INTEGER NOT NULL,
    user_id      INTEGER NOT NULL REFERENCES users(id),
    event_type   TEXT NOT NULL,     -- 'APPROVAL_PENDING', 'STOCK_LOW', ...
    entity_type  TEXT NOT NULL,     -- 'payment', 'request', 'material', ...
    entity_id    INTEGER NOT NULL,
    title        TEXT NOT NULL,
    body         TEXT,
    is_read      BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- RN-02: dedupe diario (mismo evento+entidad+usuario en el mismo dia)
    UNIQUE (user_id, event_type, entity_type, entity_id, (created_at::date))
);

CREATE INDEX idx_notif_user_unread
    ON notifications (user_id, is_read, created_at DESC);

CREATE TABLE notification_prefs (
    user_id      INTEGER NOT NULL REFERENCES users(id),
    event_type   TEXT NOT NULL,
    in_app       BOOLEAN NOT NULL DEFAULT true,
    email        BOOLEAN NOT NULL DEFAULT true,
    PRIMARY KEY (user_id, event_type)
);
```

```sql
-- migrations/047_notifications.down.sql
DROP TABLE notification_prefs;
DROP TABLE notifications;
```

## Nota

La restricción `UNIQUE (..., (created_at::date))` implementa la deduplicación
diaria de RN-02 en el propio esquema: un segundo intento del mismo evento el
mismo día choca con la unique y no crea duplicado (el `insert_notification_dedup`
usa `ON CONFLICT DO NOTHING`).
