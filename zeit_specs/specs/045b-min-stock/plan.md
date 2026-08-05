# F-045b — plan.md (diseño técnico + código de referencia)

## Decisiones y alternativas descartadas

- **¿Columna en la tabla de stock o tabla propia?** → **Tabla propia**
  `material_min_stock`. El stock actual es un dato movible y el mínimo es
  configuración; mezclarlos acopla ciclos de vida distintos. Además permite
  auditar el mínimo sin tocar la tabla caliente de stock.
- **¿El estado "bajo mínimo" se guarda o se calcula?** → **Se calcula** en la
  consulta (`stock < min`). Guardar un flag duplicaría la verdad y exigiría
  recalcularlo en cada movimiento. (F-047 hará la detección de *cruce* de umbral,
  que sí necesita estado, pero ese es su problema, no el de esta feature.)
- **¿Endpoint propio o extender el de stock?** → **Endpoint propio**
  `PUT .../min-stock`: permiso distinto (RN-03) y semántica distinta lo justifican.

## data-model.md (resumen — ver archivo aparte)

Tabla `material_min_stock` con PK `(material_id, warehouse_id)` (RN-02) y
`CHECK (min_qty >= 0)` (RN-01). Ver `data-model.md`.

## Código de referencia

### queries.py — solo SQL

```python
# app/modules/logistics/queries.py (fragmento nuevo)

SQL_UPSERT_MIN = """
    INSERT INTO material_min_stock
        (material_id, warehouse_id, min_qty, updated_by)
    VALUES (%(mid)s, %(wid)s, %(qty)s, %(uid)s)
    ON CONFLICT (material_id, warehouse_id)
    DO UPDATE SET min_qty = EXCLUDED.min_qty,
                  updated_by = EXCLUDED.updated_by,
                  updated_at = now();
"""

SQL_BELOW_MIN = """
    SELECT mat.id, mat.name, w.name AS warehouse,
           s.quantity AS current, mm.min_qty,
           (mm.min_qty - s.quantity) AS deficit
      FROM material_min_stock mm
      JOIN stock s  ON s.material_id  = mm.material_id
                   AND s.warehouse_id = mm.warehouse_id
      JOIN materials mat ON mat.id = mm.material_id
      JOIN warehouses w  ON w.id  = mm.warehouse_id
     WHERE mm.min_qty > 0
       AND s.quantity < mm.min_qty
       AND (%(wid)s IS NULL OR mm.warehouse_id = %(wid)s)
     ORDER BY deficit DESC
     LIMIT %(limit)s OFFSET %(offset)s;
"""

def get_min(conn, mid: int, wid: int) -> float:
    with conn.cursor() as cur:
        cur.execute("""SELECT min_qty FROM material_min_stock
                       WHERE material_id=%s AND warehouse_id=%s""",
                    (mid, wid))
        row = cur.fetchone()
        return float(row[0]) if row else 0.0

def upsert_min(conn, *, mid, wid, qty, uid) -> None:
    with conn.cursor() as cur:
        cur.execute(SQL_UPSERT_MIN,
                    {"mid": mid, "wid": wid, "qty": qty, "uid": uid})
```

### service.py — solo reglas de negocio

```python
# app/modules/logistics/service.py (fragmento nuevo)

def set_min_stock(*, material_id: int, warehouse_id: int,
                  min_qty: float, user_id: int) -> dict:
    if min_qty < 0:                                  # RN-01
        raise DomainError("MIN_INVALIDO",
                          "El minimo no puede ser negativo", 422)

    with get_conn(commit=True) as conn:
        before = queries.get_min(conn, material_id, warehouse_id)
        queries.upsert_min(conn, mid=material_id, wid=warehouse_id,
                           qty=min_qty, uid=user_id)
        audit.log(conn, user_id=user_id,                 # RN-03
                  action="STOCK_MIN_UPDATED",
                  entity=("material", material_id),
                  detail={"warehouse_id": warehouse_id,
                          "before": before, "after": min_qty})
    return {"material_id": material_id,
            "warehouse_id": warehouse_id, "min_qty": min_qty}
```

### router.py — HTTP y permisos

```python
@router.put("/materials/{mid}/warehouses/{wid}/min-stock")
def put_min_stock(mid: int, wid: int, body: MinStockIn,
                  user=Depends(require("logistics:stock:set_min"))):
    return service.set_min_stock(material_id=mid, warehouse_id=wid,
                                 min_qty=body.min_qty, user_id=user.id)
```

### Frontend — columna editable + badge

```jsx
// En la tabla de Stock: columna Mínimo, editable solo con permiso
<PermissionGate permission="logistics:stock:set_min"
                fallback={<span>{row.min_qty || "—"}</span>}>
  <MinStockCell value={row.min_qty} onSave={(v) => setMin.mutate(...)} />
</PermissionGate>

// Badge de fila bajo mínimo (CA-1.2)
{row.current < row.min_qty && row.min_qty > 0 && (
  <span className="badge" style={{ background: "var(--action)" }}>
    BAJO MÍNIMO
  </span>
)}
```

### Tests — trazabilidad spec → test

```python
def test_ca_1_3_minimo_negativo_rechazado():          # CA-1.3 / RN-01
    with pytest.raises(DomainError) as e:
        service.set_min_stock(material_id=1, warehouse_id=1,
                              min_qty=-5, user_id=1)
    assert e.value.code == "MIN_INVALIDO"

def test_ca_1_1_guardar_y_leer(client, coord_token):  # CA-1.1
    r = client.put("/api/v1/logistics/materials/5/warehouses/2/min-stock",
                   headers=auth(coord_token), json={"min_qty": 25})
    assert r.status_code == 200
    assert r.json()["min_qty"] == 25

def test_rn_03_viewer_no_puede(client, viewer_token): # RN-03 / RBAC
    r = client.put("/api/v1/logistics/materials/5/warehouses/2/min-stock",
                   headers=auth(viewer_token), json={"min_qty": 25})
    assert r.status_code == 403

def test_ca_2_1_reporte_ordenado_por_deficit(client, seeded):
    r = client.get("/api/v1/logistics/stock/below-min",
                   headers=auth(seeded.viewer))
    deficits = [i["deficit"] for i in r.json()["items"]]
    assert deficits == sorted(deficits, reverse=True)  # CA-2.1
```
