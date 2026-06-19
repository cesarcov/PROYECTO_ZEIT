# Prompt para continuar en un nuevo chat

> Copia el bloque de abajo y pégalo al inicio de un nuevo chat con Claude.
> El PRÓXIMO OBJETIVO ya está pre-cargado con Fase 5B (Valorización de Proyectos).
> Actualizado: 2026-06-06 — Fixes permisos/planificación/formatUsername (migrations 027-028).

---

```
Estoy desarrollando CeShark ERP Modular — ERP para empresas de servicios en campo
(mantenimiento eléctrico/industrial en Perú).

Lee toda la memoria del proyecto en:
C:\Users\ALIEN\.claude\projects\d--PROYECTOS-ERP-MODULO\memory\

Archivos clave (leer en este orden):
1. MEMORY.md — índice
2. project_status.md — estado actual y migraciones aplicadas
3. project_roadmap.md — fases futuras con schemas y endpoints detallados
4. project_architecture.md — carpetas y decisiones no obvias
5. project_api_reference.md — todos los endpoints activos y planeados
6. feedback_patrones_erp.md — lecciones aprendidas (NO ignorar)

ESTADO ACTUAL (2026-06-06):
✅ Fase 1 — Cotizaciones APU S10-style + PDF/Excel (migration 011)
✅ Fase 2 — Órdenes de Trabajo SAP PM-style (migration 012)
✅ Fase 3 — Proveedores + Órdenes de Compra Odoo-style (migration 013)
✅ Fase 4 — Clientes + Ciclo Comercial de Cotización (migration 014)
✅ Sesión 2026-06-02: Auditoría seg. + APU multi-row + Baúles (015) + Export/Import + 5A OC↔OT (016)
✅ Fase 6A — Materiales con estado (migration 017): ACTIVO/PENDIENTE/INACTIVO + propuesta desde APU
✅ Fase 6B — Matriz Tarifas Personal (migration 018): TarifasPersonalView.jsx, APU auto-fetch tarifa
✅ Fase 6C — Categorías de Costo Configurables + Clonado (migration 019):
   - categorias_costo: 8 defaults (MO/MAT/EQP/SUM/SUB/ING/TRA/IND); APU editor dinámico
   - AdminCategoriasCosto.jsx; export_excel_service 3 hojas dinámicas; botón Duplicar
✅ Fase 7 — Inicio + Planificación Semanal + Productividad (migration 020):
   - planificacion_semanal + planificacion_subtareas + registro_productividad
   - HomeDashboard.jsx (/inicio) + AdminPlanificacion.jsx + AdminProductividad.jsx
   - Layout: botón Inicio global; Dashboard.jsx: todos → /inicio
✅ Sesión 2026-06-03: usuarios reales (026), permisos planificacion/gerencia (021-025)
✅ Sesión 2026-06-06 — Fixes críticos:
   - Migration 027: rol "Gerente General" (12 permisos) + admin:audit → Administrador General
   - Migration 028: tareas planificación reasignadas de usuarios desactivados a activos
   - App.jsx: requirePermission planificacion:/reporting: (antes admin:)
   - ProtectedRoute.jsx: homeRoute gerente→/gerencia/aprobaciones, administracion→/admin/audit
   - HomeDashboard.jsx: sección "Tareas en Seguimiento" (solo_seguimiento=true, borde verde)
   - Backend planificacion: param solo_seguimiento en router + service
   - formatUsername() aplicado a 8 archivos — sin guiones bajos en ningún display de UI

Última migración en BD: 028_reasignar_tareas_usuarios_inactivos.sql
Rutas del proyecto: D:\PROYECTOS\ERP_MODULO\erp-modular\
Frontend: http://localhost:5173 | API: http://localhost:8000

CONVENCIONES CRÍTICAS (leer antes de codear):
- Estilos inline con tokens #0B2E33, #4F7C82, #B8E3E9 — sin clases Tailwind en pages
- TODA page nueva DEBE envolver con <Layout>...</Layout>
- Módulo nuevo = carpeta en app/modules/ + registrar en main.py
- stock_movements: to_warehouse(IN), from_warehouse(OUT), created_by=username(texto)
- canExact() para solo-lectura, no hasPermission()
- Operaciones hace las cotizaciones (no Administración)
- users: columna "username" — NO existe "full_name"
- project_plans: columna "project_code" — NO existe "code"
- Endpoints /export e /import SIEMPRE antes de /{id} en el router
- requirePermission en App.jsx: usar el prefijo EXACTO del rol (planificacion:, reporting:, admin:)
- Nombres usuario: siempre formatUsername(username) — NUNCA mostrar raw username con guiones
- Para exportar usar ExportExcelButton.jsx de components/ — NO crear botones ad-hoc
- Al terminar la sesión: actualizar docs/PROMPT_NUEVO_CHAT.md y memory/

PRÓXIMO OBJETIVO: Fase 5B — Valorización de Proyectos

Sin migration. Endpoint: GET /cotizaciones/planes/{plan_id}/valorizacion
Cruza APU (planificado) vs ot_materiales de OTs CERRADAS + ordenes_compra_items RECIBIDAS
Retorna: presupuesto_total, costo_real_ots, costo_real_ocs, desviacion_pct, por_partida[]

Nueva ruta /operaciones/planes/:planId/valorizacion
Tabla partidas: APU vs real + semáforo color (<5% verde, 5-15% amarillo, >15% rojo)
Enlace desde ProjectPlanView.jsx y OTDetailView.jsx

NOTA: Ver si Antigravity dejó diseño en COLLABORATION.md antes de codificar.

Una vez leída la memoria, confirma el estado actual y el plan antes de codear.
```

---

## Versiones rápidas por objetivo (si quieres cambiar el próximo objetivo)

### 5A — Vinculación OC↔OT ✅ COMPLETADA
```
Fase 5A — COMPLETADA (2026-06-02)
migration 016 aplicada: ot_materiales.oc_id + ordenes_compra.ot_origen_id
Endpoint: POST /ot/{id}/generar-oc → busca proveedor principal → crea OC BORRADOR vinculada a OT
UI: OTDetailView.jsx tab Materiales — columna stock_disponible, chip "Sin stock" + botón "Generar OC" + modal + link OC
```

### 5B — Valorización de Proyectos
```
PRÓXIMO OBJETIVO: Fase 5B — Valorización de Proyectos
Sin migration. Endpoint: GET /cotizaciones/planes/{id}/valorizacion
Cruza APU (planificado) vs ot_materiales de OTs CERRADAS + ordenes_compra_items RECIBIDAS
Nueva ruta /operaciones/planes/:planId/valorizacion — tabla partidas + semáforo % desviación
```

### 5C — Dashboard Centro de Control 360°
```
PRÓXIMO OBJETIVO: Fase 5C — Dashboard Centro de Control 360°
Sin migration. LogisticsDashboard.jsx ya existe pero está mínimo.
4 KPI cards: materiales bajo mínimo | OTs activas | OCs pendientes | herramientas fuera
+ Buscador predictivo materiales + Panel custodia herramientas + OTs activas + OCs por vencer
```

### 6A — Materiales con estado + propuesta desde APU ✅ COMPLETADA
```
Fase 6A — COMPLETADA (2026-06-02)
Migration 017 aplicada: materials.estado/precio_referencia/propuesto_desde/cotizacion_origen_id/proveedor_referencia
POST /logistics/materials/proponer → material PENDIENTE; PATCH /{id}/validate → ACTIVO
GET /materials/pending-count → badge sidebar Layout.jsx (logistics/admin)
UI: chip ACTIVO/PENDIENTE en Materials.jsx + tab Pendientes + botón "+ Proponer" en APU editor
```

### 6B — Matriz de Tarifas de Personal
```
PRÓXIMO OBJETIVO: Fase 6B — Tarifas de personal por contexto/ubicación/modalidad
Migration 018: tabla tarifas_personal (rol × contexto × ubicacion × modalidad → tarifa)
Contextos: PARADA | PROYECTO | SERVICIO | INGENIERIA
Ubicaciones: MINA | AREQUIPA | INDUSTRIA | CUALQUIERA
Modalidades: HORA | DIA (con horas_por_dia configurable: 8 o 12)
Campos extra: tarifa_hora_extra, incluye_epp, incluye_herramientas
UI: TarifasPersonalView.jsx + integración en APU editor (autocompletado por contexto)
```

### 6C — Categorías de Costo Configurables
```
PRÓXIMO OBJETIVO: Fase 6C — Categorías de costo configurables (ERP genérico)
Migration 019: tabla categorias_costo (codigo, nombre, es_directo, orden, color_hex)
Defaults: MO, MAT, EQP, SUM, SUB, ING, TRA, IND
Migrar tipo_recurso MANO_OBRA→MO, MATERIAL→MAT, EQUIPO→EQP
UI: Panel Admin "Categorías de Costo" + APU editor usa categorías desde BD (no enum fijo)
```

### 7A — KPIs de Compras
```
PRÓXIMO OBJETIVO: Fase 7A — Reportes KPIs de Compras
Sin migration. Nuevo endpoint GET /compras/kpis?desde=&hasta=
Retorna: gasto_por_proveedor, tiempo_entrega_promedio, ocs_por_estado, top_materiales_comprados
Nueva vista /compras/reportes con tablas y gráficos
```

### 7B — Notificaciones WebSocket
```
PRÓXIMO OBJETIVO: Fase 7B — Notificaciones en tiempo real
Sin migration. WebSocket en main.py + ConnectionManager en app/core/notifications.py
Hook useNotifications en Layout.jsx — badge en sidebar
Push cuando: cambia estado OT, cambia estado OC, llega mensaje en Canal
```
