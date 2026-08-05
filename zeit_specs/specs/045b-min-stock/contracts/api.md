# F-045b — contracts/api.md

```
PUT /api/v1/logistics/materials/{mid}/warehouses/{wid}/min-stock
    permiso: logistics:stock:set_min
    Request:  { "min_qty": 25 }
    200: { "material_id": 5, "warehouse_id": 2, "min_qty": 25 }
    422: { "error": { "code": "MIN_INVALIDO" } }   si min_qty < 0   (RN-01)
    403: sin el permiso (Viewer, Operador)
```

```
GET /api/v1/logistics/stock/below-min?warehouse_id=2&page=1&page_size=50
    permiso: logistics:stock:view
    200: {
      "items": [
        { "material": "Cemento Sol", "warehouse": "Central",
          "current": 8, "min": 25, "deficit": 17 }
      ],
      "pagination": { "page": 1, "page_size": 50,
                      "total_items": 12, "total_pages": 1 }
    }
    Orden fijo: deficit DESC (CA-2.1)
```

## Modelo Pydantic de entrada

```python
class MinStockIn(BaseModel):
    min_qty: float = Field(ge=0, examples=[25])
```
