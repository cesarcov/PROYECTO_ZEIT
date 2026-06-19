# Verificación — Panel de Administración (perfil Juliet)

> **Qué es esto:** apartado consultable con el estado real de cada función que pediste en los 3 bloques de Administración (Auditoría, Reportes/KPIs, Planificación). Combina **auditoría de código** + **pruebas en vivo** contra el backend.
>
> **Fecha de verificación:** 2026-06-11 · **Probado como:** `juliet_alvis` (rol *Administrador General*) · **Backend:** `uvicorn` en `127.0.0.1:8000` con DB `erp_logistica`.
>
> **Leyenda:** ✅ funciona y verificado · ⚠️ funciona pero con observación/parcial · 🛠️ corregido en esta sesión · ❌ falta · ❓ depende de otra pantalla (por verificar).

---

## 0. Resumen ejecutivo

| Bloque | Estado | Nota |
|---|---|---|
| **Auditoría** | ✅ Operativo | Todo lo pedido está implementado y probado en vivo (lista + export Excel real). |
| **Reportes y KPIs** | 🛠️ Operativo tras corrección | **Estaba caído (HTTP 500)** → se corrigieron **3 bugs** de backend. Hoy carga las 5 áreas y exporta Excel. |
| **Planificación** | ✅ Operativo | Grid, multi-responsable, cancelar con motivo, arrastrar, 3 vistas y export funcionan. Detalle de actividad es **modal** (se convertirá a página). |

**Cómo se probó (resumen):** se levantó el backend, se hizo login real como Juliet y se golpearon los endpoints de cada bloque midiendo código HTTP, tipo de contenido y tamaño. Las funciones de UI se verificaron por auditoría del código fuente.

---

## 1. 🛠️ Bugs encontrados y corregidos en esta sesión

Los 3 estaban en el bloque **Reportes y KPIs**. El primero tapaba al segundo y el segundo al tercero (fallo en cadena), por eso la página de KPIs quedaba **en blanco** para Juliet.

| # | Archivo | Causa | Corrección |
|---|---|---|---|
| 1 | `app/modules/reporting/service.py:31` (y 91-94, 120-121, 152) | `float(None)` cuando una vista SQL agrega sin datos (ej. tasa SLA `NULL`) → `TypeError` | Helper `_f(x)` que convierte `None → 0.0`. Aplicado a todos los `float(row[...])` desprotegidos. |
| 2 | `app/modules/reporting/service.py` (query gasto compras) | `SELECT SUM(oci.cantidad * ...)` — la columna se llama `cantidad_pedida` | `oci.cantidad` → `oci.cantidad_pedida` (igual que el módulo de compras) |
| 3 | `app/modules/reporting/service.py` (query despachos) | `FROM dispatches` — esa tabla no existe | `dispatches` → `stock_dispatches` |

**Blindaje extra (frontend):** `ReportingKPIs.jsx` accedía a `data.weak_points...` sin protección; si la API fallaba, pantalla blanca. Se agregó estado de **error + botón Reintentar** cuando no hay datos.

**Verificación post-fix (en vivo):**
```
[PASS] dashboard-kpis        200 | areas: logistics, operations, compras, admin, weak_points
[PASS] dashboard-export xlsx 200 | 8733 bytes (.xlsx real)
```

---

## 2. Bloque GESTIÓN → Auditoría

Archivo: `frontend/myapp/src/pages/admin/AdminAudit.jsx` · Backend: `app/modules/admin/` (`/admin/audit-logs`, `/admin/audit-logs/export`)

| Lo que pediste | Estado | Detalle / cómo verificarlo |
|---|---|---|
| Renombrar GET/POST/PUT/PATCH/DELETE a algo entendible | ✅ | Aparecen como **Consultar / Registrar / Modificar / Eliminar**. Los chips de filtro dicen "Modificar (PUT/PATCH)", etc. |
| Tooltip al pasar el cursor explicando cada botón | ✅ | Cada chip y badge tiene `title=` con la explicación (ej. "Crear o registrar nueva información (POST)"). |
| Auditoría por día / semana / mes / año | ✅ | Selector de período: Hoy, Ayer, Últimos 7 días, Este mes, Este año, Rango personalizado. |
| Ver movimientos por usuario | ✅ | Filtro "Todos los usuarios" + dropdown con nombres formateados. |
| Filtro en cada columna | ✅ | Fila de inputs bajo cada cabecera (Fecha, Hora, Usuario, Acción, Módulo, Ruta, IP). |
| Fecha y Hora en columnas separadas | ✅ | Son dos columnas distintas. |
| Sin iconos en la tabla (mostrar nombre) | ✅ | Usuario sin avatar; Acción es texto/badge, no icono. |
| Endpoint: explicar qué da | ✅ | Renombrado a **"Ruta del sistema"** con tooltip que explica que indica qué pantalla/función se usó. *(Observación: para un admin no técnico podría ocultarse por defecto.)* |
| IP | ✅ | Presente. |
| Exportar en **Excel** (no solo CSV) | ✅ 🟢 *probado* | `GET /admin/audit-logs/export` → `.xlsx` real (223 KB en la prueba). |
| Antes de exportar, ventana con filtros (fecha, usuario, etc.), todo por defecto | ✅ | Modal de exportación con Usuario, Módulo, Tipo de acción y Rango de fechas; precargado con tus filtros activos. |
| Distribución de columnas / responsive al minimizar | ⚠️ | Usa grid con `minmax()`. Se adapta, pero conviene revisar en pantalla angosta (puede apretarse "Ruta del sistema"). |

**Resultado en vivo:** `audit-logs (list) 200 · 7631 bytes` · `audit-logs export xlsx 200 · 223541 bytes`. **Bloque sano.**

---

## 3. Bloque GESTIÓN → Reportes y KPIs

Archivo: `frontend/myapp/src/pages/admin/ReportingKPIs.jsx` · Backend: `app/modules/reporting/`

| Lo que pediste | Estado | Detalle |
|---|---|---|
| Más KPIs (no solo logística) buscando en todos los módulos | ✅ 🛠️ | Pestañas por área: **Logística, Operaciones, Compras, Administración**. |
| Dividir por áreas | ✅ | Tabs por área + tarjetas resumen cruzadas arriba. |
| Productividad por persona / por área | ✅ | Tab Administración → "Productividad por Persona" (horas + registros). |
| Saber el punto débil donde flaqueamos | ✅ | Tab **"Diagnóstico de Puntos Débiles"**: personal sobrecargado, tareas retrasadas, OTs retrasadas, alerta SLA bajo. |
| SLA vinculado a logística | ✅ | El SLA vive dentro de Logística. |
| Botón de descargar (faltaba) | ✅ 🛠️ *probado* | `GET /reporting/requests/kpis/dashboard-export` → `.xlsx` real. |
| Formato parecido a la vista | ✅ | Excel consolidado por bloques. |
| Permitir filtrar antes de descargar (sin abrumar) | ✅ | Modal: elegir qué áreas incluir + período (desde/hasta). |

**Resultado en vivo (tras corregir los 3 bugs):** `dashboard-kpis 200` con las 5 áreas; `dashboard-export 200` `.xlsx`. **Bloque sano.**

> Nota de datos: en la BD demo SLA=0, gasto=0, requerimientos=0 porque no hay registros de esos rubros — **no es un bug**, son métricas en cero por falta de datos.

---

## 4. Bloque GESTIÓN → Planificación Semanal

Archivo: `frontend/myapp/src/pages/admin/AdminPlanificacion.jsx` (2036 líneas) · Backend: `app/modules/planificacion/`

| Lo que pediste | Estado | Detalle |
|---|---|---|
| Botones: Importar Excel / Nueva actividad / Guardar | ✅ | Los 3 presentes en la cabecera. |
| Botón **Descargar** con filtros | ✅ *probado* | `GET /planificacion/actividades/export` → `.xlsx`. Modal con fecha, prioridad, estado, cliente. |
| ↳ que el filtro incluya también **usuario/responsable** | ⚠️ | El modal de export filtra por fecha/prioridad/estado/cliente, **falta responsable**. |
| Reemplazar botones al lado de "Buscar" por filtro por columna | ✅ | Inputs/selects de filtro en cada columna. |
| Filtrar por semana / mes / año o rango | ✅ | Presets "Esta semana / Este mes / Este año" + rango de fechas. |
| Preservar histórico al arrastrar semana tras semana | ✅ | "Arrastrar (Siguiente Sem.)": marca la actual **Completada** y crea copia para la próxima semana. Hay endpoint `/historial`. |
| Duplicar actividad | ✅ | Menú ⋮ → Duplicar. |
| Menú de 3 puntitos (editar, duplicar, borrar) | ✅ | `RowActionsMenu`: Editar, Duplicar, Arrastrar, Eliminar. |
| **Varios** responsables (3, 4, 5 personas) | ✅ *verificado en API* | `responsables_ids` (multi-select con checkboxes). |
| **Varios** encargados de seguimiento | ✅ | `seguimientos_ids` (multi-select). |
| **Varios** contactos de referencia | ✅ | `contactos_ids` (multi-select de contactos del cliente). |
| Auto-orden: prioridad Alta→Media→Baja | ✅ | `sortedGrid` por rango de prioridad. |
| …y por estado Retraso→En progreso→En espera→Completado | ✅ | Segundo criterio de orden. |
| Click en tarea → ver progreso/subtareas/quién las ve, en **otra ventana** | ✅ 🛠️ | **Convertido a página dedicada** `/admin/planificacion/:id` (`PlanificacionDetalle.jsx`). Reemplaza al modal para filas guardadas; guarda directo a BD vía endpoint `bulk`. Build OK + data-path verificado a nivel API. *(Pendiente: prueba visual en navegador.)* |
| Click en cliente → su ficha (contactos, servicios cotizados/ganados/en ejecución) | ❓ | Navega a `/clientes?id=…`. Que esa ficha muestre contactos + estadísticas de servicios **depende de `ClientesView.jsx`** (pendiente de verificar en ese módulo). |
| Click en contacto → ficha del contacto (correo, número) | ✅ | Navega a `/clientes?id=…&contacto=…`. |
| Vista tipo Notion (Kanban) con auto-filtro y navegación igual | ✅ | "Tablero Kanban" con los mismos handlers de click. |
| Vista lista compacta desplegable (solo prioridad/tarea/retraso + desplegar) | ✅ | "Tarjetas Colapsables" (`expandedCards`). |
| Menú ⋮ también en esas vistas | ✅ | `RowActionsMenu` presente en Kanban y tarjetas. |
| Completadas → otra lista | ✅ | Pestaña "Completadas". |
| Servicios cancelados → lista separada | ✅ | Pestaña "Canceladas". |
| Estado "Cancelado" en prioridad/estado | ✅ | `ESTADOS` incluye "Cancelado"; sale de Activas. |
| Al cancelar, **preguntar el motivo** y registrarlo | ✅ | `cancelModalData` pide motivo y lo guarda en notas con fecha. |

**Resultado en vivo:** `actividades 200 · 38 registros` (campos `responsables_ids, seguimientos_ids, contactos_ids, subtareas` presentes) · `export xlsx 200` · `productividad/admin 200` · `bulk insert+delete 200`. **Bloque sano.**

---

## 5. Inventario de ventanas flotantes (modales) y plan de conversión

Mencionaste que **no quieres tantas ventanas flotantes**. Inventario actual y destino propuesto:

| Modal | Dónde | Qué hace | Conversión propuesta |
|---|---|---|---|
| ~~`activityDetailModal`~~ | Planificación | Detalle de actividad + subtareas + historial | ✅ **HECHO** → página `/admin/planificacion/:id` (`PlanificacionDetalle.jsx`). El modal queda solo para filas nuevas sin guardar (no existen en BD aún). |
| `cancelModalData` | Planificación | Pedir motivo de cancelación | ⏳ Pendiente · Panel/confirm en línea (es corto; puede quedar como diálogo pequeño). |
| `showExportModal` | Planificación | Configurar export | ⏳ Pendiente · Panel desplegable bajo el botón Exportar. |
| `showExportModal` | Auditoría | Configurar export | ⏳ Pendiente · Panel desplegable bajo el botón Exportar. |
| `showDownloadModal` | Reportes/KPIs | Elegir bloques a descargar | ⏳ Pendiente · Panel desplegable bajo el botón Descargar. |

---

## 6. Pendientes (no implementado / parcial)

- ✅ **Detalle de actividad** → convertido a página dedicada `/admin/planificacion/:id` (falta prueba visual en navegador).
- ⏳ **Modales restantes** (export de Auditoría/Planificación/Reportes + motivo de cancelación) → convertir a paneles en línea (siguiente paso).
- ⚠️ **Export de Planificación** sin filtro por responsable/usuario.
- ⚠️ **Responsive de tablas** (Auditoría y Planificación) en pantallas angostas — revisar.
- ❓ **Ficha de cliente** (contactos + servicios cotizados/ganados/en ejecución) — verificar que `ClientesView.jsx` lo muestre.
- ⚠️ **Filtro por columna "para todas las tablas del proyecto"** — implementado en Auditoría y Planificación; el resto de tablas del ERP aún no.

---

## 7. Cómo reproducir las pruebas

```powershell
# 1. Backend
cd d:\PROYECTOS\ERP_MODULO\erp-modular
venv\Scripts\activate
uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Login (token)
$login = Invoke-RestMethod -Uri "http://127.0.0.1:8000/auth/login" -Method Post `
  -Body "username=juliet_alvis&password=123456" -ContentType "application/x-www-form-urlencoded"
$H = @{ Authorization = "Bearer $($login.access_token)" }

# 3. Probar endpoints
Invoke-WebRequest "http://127.0.0.1:8000/reporting/requests/kpis/dashboard-kpis" -Headers $H -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:8000/admin/audit-logs/export" -Headers $H -UseBasicParsing
Invoke-WebRequest "http://127.0.0.1:8000/planificacion/actividades" -Headers $H -UseBasicParsing
```

> ⚠️ Usar `127.0.0.1`, no `localhost` (el backend bindea IPv4; `localhost` puede resolver a IPv6 `::1` y fallar).
