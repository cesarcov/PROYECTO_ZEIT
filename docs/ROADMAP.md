# Roadmap — Próximas Fases

> Ver `PROMPT_NUEVO_CHAT.md` para el prompt listo de cada fase.
> Actualizar cuando se complete una fase: mover a ESTADO_ACTUAL.md.

---

## Resumen de próximas fases

| # | Fase | Prioridad | Requiere migration |
|---|------|-----------|-------------------|
| 5A | Vinculación OC↔OT | Alta | Sí (015) |
| 5B | Valorización de Proyectos | Alta | No |
| 5C | Dashboard Centro de Control 360° | Media | No |
| 6A | Reportes y KPIs de Compras | Media | No |
| 6B | Notificaciones en tiempo real | Baja | No |

---

## Fase 5A — Vinculación OC↔OT

**Qué hace:** Desde una OT con material en stock insuficiente, el usuario puede generar directamente una OC al proveedor principal del material, sin salir del contexto de la OT.

**Migration 015 necesaria:**
```sql
ALTER TABLE ot_materiales ADD COLUMN oc_id UUID REFERENCES ordenes_compra(id);
ALTER TABLE ordenes_compra ADD COLUMN ot_origen_id UUID REFERENCES ordenes_trabajo(id);
```

**Backend:**
```
POST /ot/{ot_id}/generar-oc
body: {material_id, cantidad_faltante, almacen_id}
lógica:
  1. Busca proveedor principal (material_proveedores WHERE es_principal=TRUE)
  2. Crea ordenes_compra status=BORRADOR con ítem pre-cargado
  3. Actualiza ot_materiales.oc_id = nueva OC
  4. Retorna {oc_id, oc_code, proveedor_nombre, precio_unitario}
```

**Frontend:**
- `OTDetailView.jsx` tab Materiales: columna nueva "Stock disponible" — si cantidad_real > stock → badge rojo + botón "Generar OC"
- Modal: proveedor sugerido (del catálogo), cantidad pre-llenada, almacén destino
- Al confirmar: redirige a `/compras/oc/:ocId` para revisar y enviar

---

## Fase 5B — Valorización de Proyectos

**Qué hace:** Dashboard que compara el presupuesto APU (plan) vs los costos reales (OTs ejecutadas + OCs recibidas). Muestra la desviación por proyecto, por partida y por tipo de recurso.

**Sin migration nueva** — solo consultas sobre tablas existentes.

**Backend:**
```
GET /cotizaciones/planes/{plan_id}/valorizacion
Retorna:
{
  presupuesto_total,        -- SUM del APU
  costo_real_materiales,   -- SUM ot_materiales (OTs CERRADAS) × precio_unitario del catálogo
  costo_real_ocs,           -- SUM ordenes_compra_items (OCs RECIBIDAS vinculadas al plan)
  costo_real_total,
  desviacion_absoluta,
  desviacion_pct,
  por_partida: [{partida_codigo, partida_desc, presupuestado, real, desviacion_pct}]
}
```

**Frontend:**
- Nueva ruta: `/operaciones/planes/:planId/valorizacion`
- Gráfico de barras horizontal: APU (azul) vs Real (naranja) por partida
- Semáforo: verde < 5%, amarillo 5-15%, rojo > 15%
- Enlace desde `ProjectPlanView.jsx` (botón "Ver Valorización") y desde `OTDetailView.jsx`

---

## Fase 5C — Dashboard Centro de Control 360°

**Qué hace:** Vista unificada para el Coordinador Logístico en `/logistics`. Reemplaza el `LogisticsDashboard.jsx` actual (que está mínimo).

**Sin migration** — usa endpoints ya existentes.

**Componentes a construir:**
1. Header con 4 KPI cards accionables:
   - Materiales bajo stock mínimo (enlace a Stock filtrado)
   - OTs activas (enlace a /operaciones/ot)
   - OCs pendientes de recibir (enlace a /compras/oc)
   - Herramientas fuera de almacén (enlace a /logistics/tools)
2. Buscador predictivo de materiales (búsqueda en tiempo real)
3. Panel "Custodia activa" — herramientas asignadas + botón Devolver inline
4. Panel "OTs consumiendo stock hoy" — OTs EN_EJECUCION con materiales pendientes
5. Panel "OCs próximas a vencer" — fecha_entrega_est < 3 días

---

## Fase 6A — Reportes y KPIs de Compras

**Qué hace:** Panel analítico para el Jefe de Logística con métricas de compras por período.

**Sin migration** — consultas sobre tablas existentes.

**Backend:**
```
GET /compras/kpis?desde=YYYY-MM-DD&hasta=YYYY-MM-DD
Retorna:
{
  gasto_por_proveedor: [{proveedor_id, nombre, total_comprado, n_ocs, cumplimiento_pct}],
  tiempo_entrega: [{proveedor_id, dias_prometidos_avg, dias_reales_avg}],
  ocs_por_estado: {borrador, enviada, aprobada, en_transito, recibida, cerrada},
  top_materiales: [{material_id, nombre, cantidad_total, gasto_total}],
  gasto_total_periodo
}
```

**Frontend:**
- Nueva ruta: `/compras/reportes`
- Filtro de período (desde/hasta)
- Tabla de proveedores con ranking + % cumplimiento
- Cards de OCs por estado
- Top 10 materiales más comprados

---

## Fase 6B — Notificaciones en Tiempo Real

**Qué hace:** WebSocket que envía push al frontend cuando cambia estado de OT, OC o llega mensaje en Canal. Aparece como toast en la esquina de la pantalla.

**Sin migration** — infraestructura nueva en el core.

**Backend:**
```python
# app/core/notifications.py — ConnectionManager
# main.py — @app.websocket("/ws/{user_id}")
# Llamar desde service.py de OT, OC y canal al cambiar estado:
# await manager.broadcast_to_user(user_id, {"type": "OT_STATUS", ...})
```

**Frontend:**
```jsx
// hooks/useNotifications.js
// Conectar en Layout.jsx al montar
// Toast component con animación en esquina inferior derecha
```

---

## Deuda técnica (sin fase asignada)

- Auth en endpoints `/reporting/*` (actualmente sin token)
- Paginación en materiales, movimientos, OTs
- Tests unitarios e integración backend
- CI/CD pipeline básico
- Exportación Excel/PDF de reportes generales
