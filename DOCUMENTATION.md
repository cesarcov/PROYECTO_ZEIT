# Documentación del Proyecto ZEIT (ERP Modular)

## Visión General
El proyecto es un sistema ERP modular diseñado para la gestión logística, administrativa y operativa. Está construido con una arquitectura moderna de separación de preocupaciones (Backend API + Frontend SPA).

## Arquitectura Técnica

### Backend
*   **Lenguaje**: Python 3.x
*   **Framework**: FastAPI
*   **Servidor**: Uvicorn
*   **Base de Datos**: PostgreSQL (conectado vía `psycopg2`)
*   **Autenticación**: JWT (JSON Web Tokens)
*   **Estructura**: Modular (`app/modules/*`)

### Frontend
*   **Framework**: React 19
*   **Build Tool**: Vite
*   **Estilos**: TailwindCSS v4
*   **Routing**: React Router DOM v7
*   **Ubicación**: `frontend/myapp/`

---

## Estructura del Backend (`app/`)

### Core (`app/core/`)
Componentes transversales del sistema:
*   **Configuración** (`config.py`): Manejo de variables de entorno con Pydantic.
*   **Base de Datos** (`database.py`): Gestión de conexiones a PostgreSQL.
*   **Seguridad** (`security/`):
    *   `auth.py`: Generación y validación de tokens JWT.
    *   `permissions.py`: Sistema de permisos basado en scopes (ej. `admin:users`, `logistics:stock:move`).
    *   `hashing.py`: Hashing de contraseñas.
*   **Auditoría** (`audit/`): Middleware para registrar acciones de usuarios.

### Módulos (`app/modules/`)

#### 1. Admin (`app/modules/admin`)
Gestión de usuarios y seguridad del sistema.
*   **Endpoints Principales**:
    *   `POST /admin/users`: Crear usuarios (Solo Admin).
    *   `GET /admin/users`: Listar usuarios.
    *   `PUT /admin/users/{id}/roles`: Asignar roles.
    *   `PATCH /admin/users/{id}/status`: Activar/Desactivar usuarios.
    *   `GET /admin/audit-logs`: Ver logs de auditoría.

#### 2. Logística (`app/modules/logistics`)
Núcleo de la gestión de inventarios y almacenes.
*   **Funcionalidades**:
    *   **Materiales**: CRUD de materiales, Importación masiva desde Excel.
    *   **Stock**:
        *   Control de movimientos (Entradas/Salidas).
        *   Kardex (Historial de movimientos).
        *   Alertas de stock bajo y negativo.
        *   Consultas por almacén y proyecto.
    *   **Herramientas**: Asignación a operarios, devoluciones y mantenimiento.
    *   **Almacenes y Proyectos**: Gestión de ubicaciones físicas y centros de costos.
    *   **Importaciones**: Carga masiva de stock inicial y movimientos.

#### 3. Requerimientos / Requests (`app/modules/requests`)
Gestión de solicitudes de materiales por parte de operarios y aprobaciones.
*   **Reservas de Stock**:
    *   Crear reserva (Bloquea stock lógico).
    *   Confirmar (Mueve a `IN_TRANSIT`).
    *   Expiración automática de reservas vencidas.
    *   Liberar reservas.
*   **Solicitudes de Material**:
    *   Flujo de aprobación/rechazo por parte de Logística.
    *   Vista operativa para priorización diaria.

#### 4. Reportes (`app/modules/reporting`)
Dashboard y métricas para la toma de decisiones.
*   **KPIs**:
    *   Resumen de solicitudes.
    *   Cumplimiento de SLA (Nivel de Servicio).
    *   Lead Time (Tiempos de atención).
    *   Desempeño por aprobador.

---

## Estructura del Frontend (`frontend/myapp/`)

### Rutas y Vistas (`App.jsx` & `pages/`)
El frontend utiliza rutas protegidas basadas en roles (`admin`, `logistics`, `operations`).

*   **Público**:
    *   `/`: Login.
*   **General** (Auth required):
    *   `/dashboard`: Panel principal (`Dashboard.jsx`).
*   **Admin**:
    *   `/admin`: Dashboard de Administrador (`pages/admin/AdminDashboard`).
    *   `/admin/users`: Gestión de Usuarios (`pages/admin/AdminUsers`).
*   **Logística**:
    *   `/logistics`: Dashboard de Logística (`pages/logistics/LogisticsDashboard`).
    *   `/materials`: Gestión de Materiales (`Materials.jsx`).
*   **Operaciones**:
    *   `/operations`: Dashboard de Operaciones (`pages/operations/OperationsDashboard`).

### Componentes Clave
*   `ProtectedRoute`: Wrapper para seguridad de rutas según rol del usuario.

## Comandos Útiles

### Backend
```bash
# Iniciar servidor de desarrollo
python -m uvicorn app.main:app --reload
```

### Frontend
```bash
# Iniciar servidor de desarrollo
cd frontend/myapp
npm run dev
```
