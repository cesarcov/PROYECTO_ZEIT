# CeShark ERP Modular — Guía Rápida de Contexto

> Para quién es este archivo: cualquier colaborador o IA que necesite entender el proyecto en menos de 5 minutos y ponerse a trabajar.
> Documento detallado completo: ver `PROYECTO.md`

---

## ¿Qué es este sistema?

ERP modular para empresas de **servicios en campo** (ej. mantenimiento eléctrico). Gestiona inventario, herramientas, solicitudes de material, despachos y planificación de proyectos. El operario en campo planifica sus requerimientos; el encargado de logística los valida y despacha.

**Nombre comercial:** ZEIT ERP / CeShark ERP Modular v2.0.0

---

## Stack en una línea

| Capa       | Tecnología                                                  |
|------------|-------------------------------------------------------------|
| Backend    | Python 3 · FastAPI 0.128 · Uvicorn · PostgreSQL · JWT       |
| Frontend   | React 19 · Vite · TailwindCSS v4 · React Router DOM v7     |
| Auth       | JWT con scopes de permisos (`logistics:stock:move`, etc.)   |
| Auditoría  | Middleware automático en cada mutación (POST/PUT/PATCH/DELETE) |

---

## Arrancar el proyecto

```powershell
# Carpeta raíz del proyecto:
cd D:\PROYECTOS\ERP_MODULO\erp-modular

# Opción rápida (abre todo y el navegador):
.\iniciar.bat

# Opción npm (requiere estar en erp-modular/, NO en ERP_MODULO/):
npm start
```

| Servicio  | URL                         |
|-----------|-----------------------------|
| Frontend  | http://localhost:5173        |
| API       | http://localhost:8000        |
| Swagger   | http://localhost:8000/docs   |

**Archivo `.env`** requerido en la raíz con: `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`

---

## Módulos y roles

```
admin       → gestión de usuarios, roles, auditoría
logistics   → inventario, almacenes, despachos, herramientas, compras
operations  → planes de proyecto, requerimientos, solicitudes, reservas
reporting   → KPIs y métricas (SLA, lead time, por aprobador)
```

**Tres roles de usuario:** `admin` · `logistics` · `operations`

El sidebar y las rutas protegidas se filtran automáticamente por rol via `ProtectedRoute` y `ROLE_LABELS` en `Layout.jsx`.

---

## Árbol de archivos clave

```
app/
  main.py                          ← registro de routers + CORS + AuditMiddleware
  core/security/auth.py            ← JWT login/refresh
  core/security/permissions.py     ← require_permission("scope") dependency
  modules/
    admin/          router · service · schemas · repository
    logistics/      router · service · schemas · repository (módulo más grande)
    operations/     router · service · schemas
    requests/       router · service · schemas
    reporting/      router · service · schemas

frontend/myapp/src/
  App.jsx                          ← todas las rutas protegidas por rol
  components/Layout.jsx            ← sidebar + topbar + menú de usuario
  pages/
    logistics/LogisticsDashboard.jsx   ← panel principal logística (EN DESARROLLO)
    operations/MyProjects.jsx          ← lista de planes del operario
    operations/ProjectPlanView.jsx     ← editor de plan + bóvedas + envío a logística
    operations/MaterialGroupsModal.jsx ← modal de bóvedas (NUEVO)

migrations/
  001_roles_permissions_dispatch.sql
  002_project_plans.sql
  002b_project_plans_decouple.sql
  003_material_validation.sql
  004_plan_submissions.sql
  005_roles_estructura_erp.sql
  006_purge_legacy_roles.sql
  007_material_groups.sql          ← NUEVO: tablas material_groups + material_group_items
```

---

## Decisiones de arquitectura que no son obvias

### 1. Plans de Operaciones ≠ Proyectos de Logística
- `project_plans` (tabla) = documentos de planificación creados por el operario. Tienen `custom_project_name` y código auto-generado (`PRO-YYYY-NNNN`).
- `projects` (tabla) = catálogo de proyectos gestionado por logística para rastrear stock.
- Se conectan **solo cuando el operario envía un "requerimiento" (submission)**. Antes de eso, logística no ve el plan.

### 2. Bóvedas de Materiales (nuevo, 2026-06-01)
- Plantillas reutilizables de materiales con cantidades y % desgaste predefinidos.
- Al aplicar una bóveda al plan, cada material se **copia como ítem independiente**.
- Editar un ítem del plan NO modifica la bóveda original.
- Acceso: desde cualquier plan → botón "📦 Bóvedas".
- Requiere migración `007_material_groups.sql` ejecutada en PostgreSQL.

### 3. Flujo de Submission (requerimiento)
```
Operario agrega materiales al plan
  → Botón "Enviar Req. #N" → submission numerada
  → Logística la ve en /logistics/project-submissions
  → Logística aprueba/rechaza ítem por ítem
  → Ítems aprobados → logística crea despacho
  → Operario confirma recepción → stock se descuenta
```

### 4. Permisos granulares
Los permisos se verifican por endpoint. Ejemplos:
- `logistics:stock:move` → crear/editar materiales, movimientos, almacenes
- `logistics:dispatch:create` → crear despacho
- `logistics:materials:validate` → aprobar/rechazar material propuesto

### 5. Auditoría automática
`AuditMiddleware` registra **todas** las mutaciones automáticamente. No requiere código adicional en los servicios.

---

## Estado actual del desarrollo (2026-06-01)

### Completado ✅
- CRUD completo de materiales, almacenes, proyectos (logística)
- Control de stock con Kardex, alertas bajo/negativo, ubicaciones físicas (rack/nivel/gaveta)
- Herramientas: asignación a operarios, devolución, mantenimiento, calibración
- Despachos: flujo PENDING → READY → DELIVERED con confirmación del operario
- Reservas de stock: BLOCKED → IN_TRANSIT con expiración automática
- Solicitudes de material: flujo aprobación/rechazo por logística
- Planes de proyecto (operaciones): CRUD, envío de requerimientos (submissions) a logística
- Revisión de submissions por logística ítem a ítem
- Propuesta de nuevos materiales por el operario (validación posterior por logística)
- Lista de compras con estados
- KPIs y reportes: SLA, lead time, por aprobador, tendencia mensual
- **Bóvedas de materiales**: plantillas reutilizables aplicables a planes con 1 clic
- Editar y eliminar planes desde "Mis Proyectos"
- Topbar muestra rol en vez de nombre de usuario técnico

### En desarrollo 🔧
- LogisticsDashboard: transformación a Centro de Control 360° accionable
  - Acciones directas: "Despachar", "Transferir", "Comprar" desde el panel
  - Buscador predictivo de materiales con ubicación física
  - Modal de devolución de herramientas sin salir del dashboard

### Pendiente 📋
- Notificaciones en tiempo real (WebSockets) para alertas de stock
- Exportación Excel/PDF de reportes
- Paginación en endpoints con volumen alto
- Tests unitarios e integración del backend
- CI/CD pipeline

---

## Convenciones del código

- **Backend:** módulo = carpeta con `router.py`, `service.py`, `schemas.py`. Toda lógica de BD va en `service.py` usando `db_connection()` como context manager.
- **Frontend:** estilos inline con objetos JS (sin clases de Tailwind en los componentes de pages). Design system: fondo `#0B2E33`, acento `#B8E3E9`, `#4F7C82` para interactivos.
- **API base URL en frontend:** `import.meta.env.VITE_API_URL ?? "http://localhost:8000"` — definido con `const API = ...` al inicio de cada archivo que hace fetch.
- **Autenticación frontend:** `localStorage.getItem("access_token")` en cada componente que llama a la API.

---

*Para el detalle completo de endpoints, esquemas de BD, flujos y roadmap → ver `PROYECTO.md`*
