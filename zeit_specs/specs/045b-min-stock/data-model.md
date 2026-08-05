# F-045b — data-model.md (migración 045b)

```sql
-- migrations/045b_min_stock.sql
CREATE TABLE material_min_stock (
    material_id   INTEGER NOT NULL REFERENCES materials(id),
    warehouse_id  INTEGER NOT NULL REFERENCES warehouses(id),
    min_qty       NUMERIC(12,2) NOT NULL CHECK (min_qty >= 0),   -- RN-01
    updated_by    INTEGER NOT NULL REFERENCES users(id),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (material_id, warehouse_id)                       -- RN-02
);
```

```sql
-- migrations/045b_min_stock.down.sql
DROP TABLE material_min_stock;
```

## Notas

- La PK `(material_id, warehouse_id)` implementa RN-02 (mínimo por combinación,
  no global) y a la vez hace idempotente el `UPSERT`.
- El `CHECK (min_qty >= 0)` mueve RN-01 al esquema: aunque el código lo olvidara,
  Postgres rechaza el negativo.
- No se guarda el estado "bajo mínimo": se calcula en `SQL_BELOW_MIN` (ver plan.md).
