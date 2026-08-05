# ZEIT Solutions ERP — Alcance y estado del proyecto

**Actualizado:** 2026-08-05  
**Director técnico:** Cesar Huamani  
**Repositorio:** https://github.com/cesarcov/PROYECTO_ZEIT  
**Frontend en producción:** https://proyecto-zeit.vercel.app  
**Backend en producción:** https://erp-backend-00j7.onrender.com  

---

## ¿Qué es este proyecto?

Un ERP (Enterprise Resource Planning) industrial hecho a medida para empresas de logística y operaciones en el Perú. El objetivo es tener algo comparable a Odoo o SAP, pero adaptado a la realidad de una empresa industrial peruana — en español, con los módulos que realmente se usan, sin pagar licencias.

No es una demo ni un prototipo. Es un sistema en producción, con base de datos real, usuarios reales y flujos de negocio reales.

---

## Cómo se construye

El sistema se desarrolla sesión a sesión con Claude Code (IA) actuando como desarrollador fullstack. El director técnico (Cesar) guía la dirección y las prioridades; la IA ejecuta backend, frontend, base de datos y despliegue.

Para las funcionalidades nuevas se sigue un proceso formal llamado **SDD (Spec-Driven Development)**:

```
/speckit-specify  →  definir qué queremos
/speckit-plan     →  diseñar cómo lo haremos
/speckit-tasks    →  dividir en tareas concretas
/speckit-implement →  ejecutar las tareas
```

Esto garantiza que cada feature esté documentada antes de codificarse, con especificación, modelo de datos, contrato de API y checklist de validación.

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 · FastAPI · psycopg2 (SQL directo) · JWT · Pydantic v2 |
| Base de datos | PostgreSQL en Supabase (cloud) · 45 migraciones aplicadas |
| Frontend | React 18 · Vite · Tailwind CSS v4 · React Router DOM |
| Despliegue | Backend → Render (free tier) · Frontend → Vercel |
| Autenticación | JWT con refresh token · RBAC (roles + permisos granulares) |
| Marca | Tokens CSS configurables desde Admin — `--primary`, `--accent`, `--action`, `--text-muted` |

---

## Arquitectura general

```
Usuario (navegador)
    │
    ▼
Vercel — React SPA (frontend)
    │  apiFetch() con Bearer token
    ▼
Render — FastAPI (backend)
    │  psycopg2 con ThreadedConnectionPool
    ▼
Supabase — PostgreSQL (base de datos)
```

**Principios de diseño que no se negocian:**
- Todo SQL vive en el `service.py` de cada módulo — nunca en el router
- Los colores van en variables CSS (`var(--primary)`) — nunca hex fijos en el código
- Cada migración tiene su propio archivo `.sql` numerado — nunca SQL en el código Python
- La seguridad valida en el backend — el frontend solo muestra u oculta

---

## Módulos del sistema

### Backend — `app/modules/`

| Módulo | Qué hace |
|---|---|
| `auth` | Login, logout, refresh token, perfil, preferencias |
| `admin` | Usuarios, roles, permisos, auditoría, bloques de acceso |
| `superadmin` | Administración maestra multi-empresa (nivel dios) |
| `branding` | Marca blanca — nombre, logo, 4 colores corporativos |
| `logistics` | Materiales, almacenes, stock, movimientos, reservas, herramientas, despachos, importación |
| `operations` | Proyectos (planes de trabajo), órdenes de trabajo, entregas |
| `planificacion` | Planificación de actividades con asignados, productividad |
| `cotizaciones` | Cotizaciones (APU — análisis de precio unitario) |
| `compras` | Órdenes de compra vinculadas a OT |
| `clientes` | Registro de clientes con contactos |
| `canal` | Canal de comunicación inter-módulo |
| `gerencia` | Panel de aprobaciones gerenciales |
| `requerimientos` | Gestión de requerimientos por proyecto |
| `requests` | Solicitudes de materiales y reservas de stock |
| `reporting` | KPIs y dashboards ejecutivos |
| `finance` | (En desarrollo) Módulo financiero |
| `search` | Buscador global en tiempo real |

### Frontend — `src/pages/`

| Sección | Páginas |
|---|---|
| **Inicio** | Dashboard hub, Home con KPIs, Login |
| **Admin** | Dashboard · Usuarios · Roles · Auditoría · Branding · Categorías · Recursos Humanos · Reportes · Planificación admin · Productividad · Superadmin bloques |
| **Logística** | Dashboard · Materiales · Stock · Movimientos · Almacenes · Inventario físico · Lotes · Reservas · Herramientas · Proyectos · Detalle de proyecto · Transferencias · Despachos · Importación · Lista de compras |
| **Operaciones** | Órdenes de trabajo · Detalle de OT |
| **Cotizaciones** | Vista de presupuesto (APU) |
| **Compras** | Órdenes de compra |
| **Clientes** | Dashboard de clientes |
| **Canal** | Canal inter-módulo |
| **Gerencia** | Panel de aprobaciones |
| **Solicitudes** | Mis solicitudes · Todas las solicitudes |
| **Perfil** | Perfil con avatar, nombre display, bloques asignados |
| **Preferencias** | Configuración de tabla, notificaciones, formato |

---

## Sistema de roles y permisos (RBAC)

El sistema usa **roles** con **permisos granulares**. Un usuario puede tener un rol, y el rol tiene un conjunto de permisos habilitados.

### Roles existentes (12)

| Rol | Acceso típico |
|---|---|
| Administrador Maestro | Acceso total — gestiona toda la plataforma |
| Administrador General | Admin sin acceso superadmin |
| Asistente Administrativo | Admin básico + creación |
| Gerente General | Aprobaciones gerenciales + reportes |
| Gerente Logístico | Logística completa |
| Coordinador Logístico | Logística operativa |
| Operador Logístico | Operaciones básicas de almacén |
| Supervisor de Operaciones | Supervisión de OT y entregas |
| Ingeniero de Campo | Ejecución de órdenes de trabajo |
| Auditor | Solo lectura — auditoría y reportes |
| Tesorería | (En configuración) |
| **Viewer** | **Solo visualización** — para practicantes e invitados |

### Permisos del rol Viewer (11 — solo lectura)

Este rol fue diseñado para practicantes o visitas que necesitan ver cómo funciona el sistema sin poder modificar nada:

- `admin:audit` — Ver log de auditoría
- `gerencia:view` — Ver panel de gerencia
- `logistics:materials:view` — Ver catálogo de materiales
- `logistics:plan_submissions:view` — Ver solicitudes de materiales
- `logistics:reports:view` — Ver reportes de logística
- `logistics:reservations:view` — Ver reservas de equipos
- `logistics:stock:view` — Ver inventario y stock
- `operations:deliveries:view` — Ver entregas
- `reporting:view` — Ver reportes generales
- `requests:view:all` — Ver todas las solicitudes
- `requests:view:own` — Ver sus propias solicitudes

### Bloques de acceso por módulo

Además del RBAC, el **Administrador TI** puede asignar a cada usuario qué bloques (módulos) del sidebar puede ver. Es una capa adicional de control visual — útil para que un ingeniero de campo solo vea sus módulos relevantes.

---

## Marca blanca (White-label)

El ERP puede reconfigurarse para otra empresa desde **Admin → Marca**:

| Campo | Qué controla |
|---|---|
| Nombre del producto | Aparece en el logo y en el navegador |
| Eslogan | Tagline debajo del nombre |
| Logo | 4 variantes: claro, oscuro, isotipo, favicon |
| Color Primario | Azul principal — sidebar, botones, encabezados |
| Color Acento | Color de detalle y puntos activos |
| Color Acción | Naranja — botones de acción principales |
| Color Texto Secundario | Textos auxiliares, placeholders, etiquetas |

Los colores se validan con la fórmula WCAG 2.1 (contraste mínimo 4.5:1) antes de guardar. Si el color elegido no tiene suficiente contraste legible, el sistema bloquea el guardado y muestra el ratio calculado.

**Defaults corporativos ZEIT:**
- Primario: `#003A8C` (Azul Confianza)
- Acento: `#00D4D8` (Turquesa Tecnología)
- Acción: `#FF6B00` (Naranja Energía)
- Texto secundario: `#5A6573` (Gris Profesional)

---

## Base de datos — historial de migraciones

45 migraciones aplicadas en orden cronológico. Las más relevantes:

| Nro | Qué hace |
|---|---|
| 000 | Esquema base completo |
| 001 | Roles, permisos, despachos |
| 002 | Planes de proyecto |
| 005 | Estructura de roles ERP |
| 009 | Logística avanzada (almacenes, lotes, herramientas) |
| 011 | Cotizaciones APU |
| 014 | Clientes y ciclo de cotización |
| 020 | Planificación y productividad |
| 023 | Aprobaciones de gerencia |
| 034 | Preferencias de usuario |
| 035 | Marca blanca (branding) |
| 037 | Seguridad — eliminación de contraseña en texto plano |
| 038 | Estructura multi-base de datos |
| 039 | Avatar de usuario |
| 040 | Permisos por bloque de módulo |
| 041 | Nombre completo de usuario |
| 042 | Importación masiva de planes |
| **043** | **4to token de color — color_texto_secundario** |

---

## Credenciales del sistema

**Ninguna contraseña se documenta ni se versiona** (regla 6 de `CONSTITUTION.md`).

| Usuario | Dónde vive la credencial | Rol |
|---|---|---|
| `admin` | Hash en la tabla `users`. Se rota con `scripts/rotate_admin_password.py`, que imprime la contraseña una sola vez. | Administrador Maestro |
| `superadmin` | Variables de entorno `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD_HASH` del gestor de secretos. Se generan con `scripts/generate_superadmin_hash.py`. | Superadmin (nivel sistema) |

Los usuarios de demostración (practicantes, visitas) usan el rol **Viewer** y sus
contraseñas las genera `scripts/seed_users.py` de forma aleatoria.

---

## Estado actual — qué está funcionando

### En producción (Vercel + Render + Supabase)

- Login con usuario y contraseña ✓
- Login con correo electrónico ✓
- Recuperación de contraseña ✓
- Impersonación de usuario (admin puede entrar como otro usuario) ✓
- Buscador global en tiempo real (Ctrl+K) ✓
- Perfil con avatar y nombre display ✓
- Preferencias de tabla, idioma y formato ✓
- Marca blanca con 4 colores corporativos y validación WCAG ✓
- Módulo Logística completo (materiales, stock, almacenes, movimientos, lotes, transferencias, despachos, herramientas, inventario físico, importación Excel) ✓
- Módulo Operaciones (OT, planes de proyecto, entregas) ✓
- Módulo Planificación (actividades, productividad, exportación Excel) ✓
- Módulo Cotizaciones APU ✓
- Módulo Compras ✓
- Módulo Clientes ✓
- Módulo Canal inter-módulo ✓
- Módulo Gerencia (aprobaciones) ✓
- Módulo Admin (usuarios, roles, auditoría, branding) ✓
- Solicitudes de materiales con flujo completo (crear → aprobar → reservar) ✓
- Reportes y KPIs ejecutivos ✓
- RBAC completo — 12 roles, 35 permisos granulares ✓
- Bloques de acceso por módulo y usuario ✓
- 100 materiales de catálogo precargados ✓
- 10 clientes peruanos precargados ✓
- 5 cotizaciones de demostración ✓

### Limitaciones conocidas

- **Logos personalizados** se pierden en cada redeploy de Render (disco efímero en tier gratuito). Los logos default de ZEIT siempre están disponibles.
- **Backend cold start** de 30-60 segundos tras períodos de inactividad (Render free tier).
- El módulo **Finance** está en desarrollo.

---

## Cómo se despliega un cambio

1. Se modifica el código localmente
2. `git add` + `git commit` + `git push origin main`
3. **Vercel** detecta el push y redespliega el frontend automáticamente (~2 min)
4. **Render** detecta el push y redespliega el backend automáticamente (~3-5 min)
5. Si hay migraciones nuevas, se ejecutan con `python run_migrations.py` en la máquina local contra Supabase

---

## Filosofía del proyecto

- **Calidad enterprise desde el día 1** — sin atajos que se paguen caro después
- **Sin dependencias innecesarias** — el backend no usa ORM, hace SQL directo legible
- **Seguro por diseño** — RBAC en cada endpoint, auditoría de toda acción crítica
- **Configurable** — marca, colores, bloques y permisos se adaptan a cada empresa cliente
- **Documentado** — cada feature tiene su especificación en `specs/` antes de codificarse

---

*Documento generado por Claude Code · Proyecto ZEIT Solutions ERP*
