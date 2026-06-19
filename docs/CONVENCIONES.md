# Convenciones del Proyecto — Leer antes de codear

> Estas reglas evitan errores que ya costaron tiempo. No omitirlas.

---

## Reglas de código — Frontend

### 1. TODA page nueva DEBE tener Layout

```jsx
import Layout from "../../components/Layout";

export default function MiNuevaView() {
  return (
    <Layout>        {/* ← OBLIGATORIO */}
      <div>...</div>
    </Layout>
  );
}
```
**Sin Layout el usuario queda atrapado sin sidebar.**

### 2. Estilos inline con design tokens — nunca clases Tailwind en pages

```jsx
// CORRECTO
<div style={{ background: "#0B2E33", color: "#B8E3E9" }}>

// INCORRECTO
<div className="bg-teal-900 text-blue-200">
```

| Token | Valor | Uso |
|-------|-------|-----|
| PRIMARY | `#0B2E33` | Sidebar, headers, títulos |
| ACCENT | `#4F7C82` | Botones, links activos |
| LIGHT | `#EEF7F8` | Fondos de card, zebra |
| ACCENT_TEXT | `#B8E3E9` | Texto sobre PRIMARY |

### 3. Fetch con apiFetch — nunca fetch directo (excepto blobs)

```jsx
import { apiFetch } from "../../services/api";
// apiFetch agrega Authorization header automáticamente

// Excepción: exportar PDF/Excel (necesitas blob)
const res = await fetch(`${API}/cotizaciones/...`, {
  headers: { Authorization: `Bearer ${TOKEN()}` }
});
```

### 4. canExact() para detectar solo-lectura

```jsx
// CORRECTO para distinguir solo-lectura vs gestión:
const canManage = canExact("admin:users");

// INCORRECTO — admin:audit también devuelve true:
const canManage = hasPermission("admin:users");
```

---

## Reglas de código — Backend

### 5. Módulo nuevo = 4 archivos + registrar en main.py

```
app/modules/nuevo_modulo/
├── __init__.py      ← vacío
├── schemas.py       ← Pydantic models
├── service.py       ← lógica de BD con db_connection()
└── router.py        ← endpoints con prefix="/nuevo"
```

En `main.py`:
```python
from app.modules.nuevo_modulo.router import router as nuevo_router
app.include_router(nuevo_router)
```

**Si falta el include_router → 404 silencioso.**

### 6. stock_movements — columnas correctas

```python
# ENTRADA (compra recibida, devolución):
INSERT INTO stock_movements (movement_type='IN', to_warehouse=almacen_id, ...)

# SALIDA (consumo en OT, despacho):
INSERT INTO stock_movements (movement_type='OUT', from_warehouse=almacen_id, ...)

# Quién lo hizo: created_by = user["username"]  ← texto, no UUID
# NO EXISTE: warehouse_id, performed_by, tabla stock separada
# Stock vive en: stock_locations (rack/level/box/position)
```

### 7. require_permission — lista para OR lógico

```python
# Solo un permiso:
require_permission("logistics:stock:move")

# Varios (basta con uno):
require_permission(["admin:users", "admin:audit"])
```

### 8. SELECT de presupuesto_config — usar la constante

```python
# En cotizaciones/service.py existe:
_CONFIG_SELECT = "SELECT id, plan_id, ... (18 columnas en orden fijo)"

# Usar siempre _CONFIG_SELECT, nunca escribir el SELECT manual
# Las columnas nuevas de migration 014 están en posiciones fijas
```

---

## Códigos autogenerados

| Entidad | Patrón | Ejemplo |
|---------|--------|---------|
| Plan de proyecto | `PRO-YYYY-NNNN` | PRO-2026-0001 |
| Cotización | `COT-YYYY-NNNN` | COT-2026-0001 |
| Orden de Trabajo | `OT-YYYY-NNNN` | OT-2026-0001 |
| Orden de Compra | `OC-YYYY-NNNN` | OC-2026-0001 |
| Cliente | `CLI-YYYY-NNNN` | CLI-2026-0001 |
| Recurso MO | `MO-NNN` | MO-001 |
| Proveedor | `PROV-NNN` | PROV-001 |

---

## Reglas de negocio

- **Operaciones hace las cotizaciones**, no Administración
- **Al cerrar OT** → stock OUT automático por cada material con cantidad_real > 0
- **Al recibir OC** → stock IN automático (puede ser parcial, múltiples veces)
- **Cotización ENVIADA** → genera número COT- automáticamente
- **Transiciones de estado** son validadas en el service (no en el router)
- **Snapshot de precios en APU** → precio_unitario se copia al guardar, cambiar el catálogo no afecta APUs existentes
