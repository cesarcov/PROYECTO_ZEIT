# ZEIT Solutions ERP — Documentación completa del proyecto

**Actualizado:** 2026-10-13
**Director técnico:** Cesar Huamani
**Repositorio:** https://github.com/cesarcov/PROYECTO_ZEIT
**Frontend en producción:** https://proyecto-zeit.vercel.app
**Backend en producción:** https://erp-backend-00j7.onrender.com

> Este archivo es el **punto de entrada único** del proyecto. Si solo vas a leer
> un documento, lee este. Al final hay un índice de los demás y para qué sirve
> cada uno.

---

## Índice

1. [Qué es esto](#1-qué-es-esto)
2. [Estado real a día de hoy](#2-estado-real-a-día-de-hoy)
3. [Stack tecnológico](#3-stack-tecnológico)
4. [Arquitectura](#4-arquitectura)
5. [Reglas que no se negocian](#5-reglas-que-no-se-negocian)
6. [Módulos del sistema](#6-módulos-del-sistema)
7. [Lanzamiento por fases](#7-lanzamiento-por-fases)
8. [Seguridad y permisos](#8-seguridad-y-permisos)
9. [Base de datos y migraciones](#9-base-de-datos-y-migraciones)
10. [Tests y CI](#10-tests-y-ci)
11. [Cómo levantar el proyecto en local](#11-cómo-levantar-el-proyecto-en-local)
12. [Cómo se despliega](#12-cómo-se-despliega)
13. [Variables de entorno](#13-variables-de-entorno)
14. [Mapa de ramas](#14-mapa-de-ramas)
15. [Deuda técnica y limitaciones conocidas](#15-deuda-técnica-y-limitaciones-conocidas)
16. [El proceso de trabajo (SDD)](#16-el-proceso-de-trabajo-sdd)
17. [Índice del resto de documentos](#17-índice-del-resto-de-documentos)

---

## 1. Qué es esto

Un **ERP industrial** hecho a medida para empresas de logística y operaciones
en Perú. El objetivo es tener algo comparable a Odoo o SAP pero adaptado a la
realidad de una empresa industrial peruana: en español, con los módulos que
realmente se usan, sin pagar licencias.

No es una demo ni un prototipo. Está en producción, con base de datos real,
usuarios reales y flujos de negocio reales.

Se desarrolla sesión a sesión con Claude Code actuando como desarrollador
fullstack; el director técnico marca dirección y prioridades.

---

## 2. Estado real a día de hoy

Esta es la parte que suele estar desactualizada en los documentos, así que va
primero y con nombres de commit.

### Lo que está EN VIVO

La rama `main` está en el commit `ee8e686` y **lleva desde el 5 de julio sin
redesplegarse**. Lo que ven los usuarios es:

- Los 17 módulos visibles, Logística pulida y el resto a medias.
- Sin pipeline de CI, sin tests automatizados corriendo.
- Credenciales débiles y conocidas: la del usuario `admin` estaba escrita en el
  propio repositorio.
- Logos personalizados que se pierden en cada redeploy.

### Lo que está construido pero NO desplegado

Dos tandas grandes de trabajo esperan en ramas, ya en GitHub, con sus Pull
Requests pendientes de mergear. `main` está protegida: exige 3 checks de CI en
verde y un PR. Subir código a GitHub **no** despliega nada; el despliegue lo
dispara el merge.

| Rama | Commit | Qué aporta |
|---|---|---|
| `fase-0-endurecimiento` | `e513206` | Endurecimiento completo: seguridad, observabilidad, CI, backups, pool de conexiones |
| `logistica-primero` | `dd9132b` | Lanzamiento por fases: solo Logística al público |

### Cifras verificadas

| Métrica | Valor |
|---|---|
| Módulos de backend | 19 |
| Páginas de frontend | 57 |
| Migraciones de base de datos | 46 |
| Rutas de API registradas | 294 |
| Tests automatizados | 175 |
| Cobertura de tests (backend) | 31.18 % |
| Usuarios en la base de datos | 8 |
| Roles RBAC | 12 |

---

## 3. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Backend | Python 3.11 · FastAPI · psycopg2 (SQL directo, sin ORM) · JWT · Pydantic v2 |
| Base de datos | PostgreSQL en Supabase (cloud) |
| Frontend | React 19 · Vite 7 · Tailwind CSS v4 · React Router 7 |
| Despliegue | Backend → Render (free tier) · Frontend → Vercel |
| Autenticación | JWT con refresh token rotativo · RBAC con permisos granulares |
| Observabilidad | Sentry (backend y frontend) · UptimeRobot sobre `/health` |
| CI | GitHub Actions: gitleaks + ruff + migraciones desde cero + pytest + build |
| Linter | ruff (backend) · eslint (frontend) |

**Sin ORM a propósito.** Todo el SQL es visible y legible en los `service.py`.
La contrapartida es que no hay migraciones automáticas: cada cambio de esquema
es un archivo `.sql` numerado escrito a mano.

---

## 4. Arquitectura

```
Usuario (navegador)
    │
    ▼
Vercel — React SPA
    │  apiFetch() con Bearer token
    ▼
Render — FastAPI
    │  pool de conexiones (ThreadedConnectionPool)
    ▼
Supabase — PostgreSQL
```

### Cadena de middlewares del backend

El orden importa. De más externo a más interno:

```
RequestID        asigna un identificador a cada petición
  └─ CORS        valida el origen
     └─ Audit    registra la acción en audit_logs
        └─ SlowAPI    límite de peticiones por IP
           └─ Tenant  resuelve la empresa (multi-tenant)
              └─ BetaGate   cierra las áreas sin soltar
                 └─ SecurityHeaders   cabeceras de seguridad
                    └─ ruta
```

`RequestID` va el más externo a propósito: así cualquier error nacido en
cualquier capa ya tiene su identificador cuando se construye la respuesta.

### Estructura de carpetas

```
app/
├── core/                    infraestructura transversal
│   ├── config.py            TODA variable de entorno, tipada y validada
│   ├── db.py                punto único de acceso al pool de conexiones
│   ├── errors.py            sobre único de errores + request-id
│   ├── areas.py             mapa de áreas para el lanzamiento por fases
│   ├── beta_gate.py         middleware que cierra áreas sin soltar
│   ├── storage.py           subida de archivos (Supabase Storage o disco)
│   ├── observability.py     Sentry
│   ├── login_guard.py       bloqueo incremental de login por usuario
│   ├── rbac_introspect.py   introspección de permisos de las rutas
│   ├── security/            autenticación, JWT, permisos
│   └── audit/               registro de auditoría
├── modules/<nombre>/        un módulo de negocio
│   ├── router.py            valida entrada, autoriza, delega. SIN SQL
│   ├── service.py           reglas de negocio y SQL
│   └── schemas.py           modelos Pydantic
migrations/                  NNN_descripcion.sql, numeradas, inmutables
tests/                       suite de pytest
frontend/myapp/src/
├── pages/                   una carpeta por módulo
├── components/              Layout (sidebar), ProtectedRoute, Modal...
├── services/                api.js (apiFetch), observability.js
├── constants/               areas.js, blocks.js
└── theme/                   tokens CSS y ThemeProvider
```

---

## 5. Reglas que no se negocian

Están en `zeit_specs/CONSTITUTION.md` y son la fuente de verdad del proceso.

1. **Todo el SQL vive en la capa de datos.** El `router.py` valida, autoriza y
   delega. El `service.py` tiene las reglas de negocio y el SQL. Ningún SQL en
   routers.
2. **Los colores van en variables CSS** (`var(--primary)`, `var(--accent)`,
   `var(--action)`, `var(--text-muted)`). Nunca hex fijos en componentes.
3. **Cada cambio de esquema es una migración nueva.** Jamás se edita una
   migración ya aplicada; el arreglo es un archivo nuevo. El sistema de
   checksums lo verifica y aborta si alguien lo intenta.
4. **La seguridad se valida en el backend.** El frontend solo muestra u oculta.
   Un botón escondido NO sustituye la validación del endpoint.
5. **Sin spec no hay código; sin test no hay merge.**
6. **Ningún secreto en el repositorio ni en la documentación.** Solo en el
   gestor de secretos del entorno.
7. **Todo endpoint nuevo declara su permiso RBAC explícito** (deny-by-default).
8. **Toda acción de escritura relevante genera evento de auditoría.**

---

## 6. Módulos del sistema

### Backend — `app/modules/`

| Módulo | Qué hace |
|---|---|
| `logistics` | Materiales, almacenes, stock, movimientos, lotes, transferencias, inventario físico, herramientas, despachos, importación Excel |
| `operations` | Proyectos (planes de trabajo), entregas |
| `ordenes_trabajo` | Órdenes de trabajo, checklist, tiempos |
| `requests` | Solicitudes de material y reservas de stock |
| `cotizaciones` | Cotizaciones con APU (análisis de precio unitario), baúles, tarifas |
| `compras` | Órdenes de compra, proveedores |
| `clientes` | Clientes y sus contactos |
| `planificacion` | Actividades con asignados, subtareas, productividad |
| `requerimientos` | Requerimientos por proyecto y sus costos |
| `gerencia` | Panel de aprobaciones gerenciales |
| `canal` | Canal de comunicación entre módulos |
| `reporting` | KPIs y dashboards ejecutivos |
| `admin` | Usuarios, roles, permisos, auditoría, bloques de acceso |
| `superadmin` | Administración maestra multi-empresa |
| `branding` | Marca blanca: nombre, logo, 4 colores corporativos |
| `search` | Buscador global en tiempo real (Ctrl+K) |
| `finance` | En desarrollo |
| `assets` | Activos |

### Frontend — `frontend/myapp/src/pages/`

Inicio (dashboard, KPIs, login) · Admin (usuarios, roles, auditoría, marca,
categorías, RRHH, reportes, planificación, productividad) · Logística
(materiales, stock, movimientos, almacenes, inventario físico, lotes, reservas,
herramientas, proyectos, transferencias, despachos, importación, lista de
compras) · Operaciones · Cotizaciones · Compras · Clientes · Canal · Gerencia ·
Solicitudes · Perfil · Preferencias.

---

## 7. Lanzamiento por fases

**Disponible en la rama `logistica-primero`, pendiente de mergear.**

De los 17 módulos solo Logística está pulida. El resto funciona a medias y se
sigue desarrollando **en producción, sobre datos reales**, pero solo lo ve el
desarrollador. Spec completa en
`zeit_specs/specs/001-lanzamiento-por-fases/spec.md`.

| Área | Estado |
|---|---|
| Logística | Pública |
| Administración (usuarios, roles, auditoría, marca) | Pública |
| Solicitudes de material | Pública |
| Perfil y Preferencias | Pública |
| Operaciones · Cotizaciones · Compras · Clientes · Canal · Gerencia · Planificación · Requerimientos | En beta, solo beta testers |

### Cómo se controla

```
MODULOS_BETA=operaciones,cotizaciones,compras,clientes,canal,gerencia,planificacion,requerimientos
BETA_TESTERS=tu_usuario
```

**Soltar un módulo al público** = quitarlo de `MODULOS_BETA` y redesplegar. Sin
tocar código ni base de datos. Marcha atrás: volver a añadirlo.

### Tres capas, porque esconder el menú no es esconder

1. **Backend** — un middleware por prefijo de URL devuelve **404** (no 403: un
   403 confirma que la ruta existe). Cubre las ~294 rutas de golpe y deja
   cerrado cualquier endpoint nuevo de un área beta automáticamente.
2. **Sidebar** — los enlaces desaparecen, filtrados *uno a uno*. Hace falta así
   porque el menú de Logística enlaza a `/compras` y `/canal`, y el de Admin a
   `/planificacion` y `/clientes`: filtrar por módulo entero dejaría enlaces
   muertos dentro de áreas públicas.
3. **Rutas** — teclear la URL a mano redirige al inicio.

### Guardarraíles

- `logistica`, `admin` y `solicitudes` **no se pueden** poner en beta: cerrarlas
  dejaría el ERP inservible y sin forma de recuperarlo.
- Un nombre mal escrito en `MODULOS_BETA` se **ignora y avisa**. El fallo
  peligroso es el silencioso: creer que un módulo está cerrado cuando una
  errata lo dejó abierto.
- Ser administrador **no** da acceso a la beta. Solo los usuarios de
  `BETA_TESTERS`, más el superadmin.

---

## 8. Seguridad y permisos

### Autenticación

- **JWT** con `access_token` (480 min en producción) y `refresh_token` rotativo
  de 7 días.
- El refresh **rota**: usar un token dos veces lo invalida y revoca todas las
  sesiones del usuario (detección de reuse attack).
- Máximo 2 sesiones activas por usuario; la más antigua se revoca.
- El superadmin **no vive en la base de datos**: su usuario y el hash de su
  contraseña están en variables de entorno, así que funciona aunque no haya
  ninguna empresa configurada.

### Contra la fuerza bruta

Dos frenos complementarios:

- **Por IP**: 5 intentos por minuto en `/auth/login` (slowapi).
- **Por usuario**: tras 5 fallos, la espera se duplica (60 s → 120 s → 240 s…)
  con techo de 15 minutos. Así cambiar de IP no ayuda al atacante, y el techo
  evita que un atacante deje bloqueado a un usuario legítimo para siempre.

El mensaje de error es **idéntico** para usuario inexistente y contraseña
incorrecta: revelar la diferencia permite enumerar cuentas.

### RBAC — roles y permisos

12 roles con permisos granulares del tipo `modulo:recurso:accion`.

| Rol | Acceso típico |
|---|---|
| Administrador Maestro | Total |
| Administrador General | Admin sin superadmin |
| Asistente Administrativo | Admin básico |
| Gerente General | Aprobaciones y reportes |
| Gerente Logístico | Logística completa |
| Coordinador Logístico | Logística operativa |
| Operador Logístico | Almacén básico |
| Supervisor de Operaciones | Supervisión de OT y entregas |
| Ingeniero de Campo | Ejecución de OT |
| Auditor | Solo lectura |
| Tesorería | En configuración |
| Viewer | Solo lectura, para practicantes e invitados |

Además del RBAC, el administrador puede asignar a cada usuario qué **bloques**
del sidebar ve (`user_block_permissions`). Es una capa visual adicional.

### El agujero que falta cerrar

De las **294 rutas** del API:

| Protección | Rutas |
|---|---|
| Con permiso RBAC explícito | 88 |
| **Solo exigen estar autenticado** | **200** |
| Públicas (justificadas en lista blanca) | 6 |

**Esas 200 son deuda real**: hoy cualquier usuario con sesión válida puede
llamarlas sin importar su rol. Están congeladas en
`tests/rbac_deuda_baseline.json` como trinquete: una ruta **nueva** sin permiso
pone el CI en rojo, y la lista solo puede encoger. Cerrarlas del todo es
trabajo de una spec propia.

### Subida de archivos

Todo archivo subido (logos, avatares) se valida y se **re-encodea** antes de
almacenarse:

1. Se comprueba el tamaño (máx. 2 MB).
2. El tipo se detecta por **firma binaria**, no por la extensión del nombre —
   la extensión la controla quien sube el archivo.
3. Las imágenes se abren con Pillow y se reescriben desde sus píxeles. Eso
   destruye cualquier payload incrustado y descarta metadatos EXIF.
4. Los SVG se rechazan si contienen scripts, manejadores de eventos o
   referencias externas: un SVG es XML ejecutable.

### Cabeceras y CORS

`X-Content-Type-Options` · `X-Frame-Options` · `Referrer-Policy` ·
`Permissions-Policy` · `Content-Security-Policy` ·
`Cross-Origin-Resource-Policy` · `Strict-Transport-Security` (solo en
producción).

CORS: en producción **solo** los orígenes exactos de `CORS_ORIGINS`. Los puertos
locales de Vite se añaden únicamente fuera de producción.

### Formato único de errores

Todo error del API sale con la misma forma:

```json
{
  "error": {
    "code": "stock_insuficiente",
    "message": "No hay stock suficiente",
    "request_id": "7b49e52ba7834e4c"
  },
  "detail": "No hay stock suficiente"
}
```

Un error no manejado **nunca** filtra el traceback: se registra completo en los
logs con su `request_id`, y al usuario solo le llega ese identificador para
reportar el incidente. El mismo `request_id` viaja en la cabecera
`X-Request-ID` y se etiqueta en Sentry.

> `detail` se mantiene solo por compatibilidad con las pantallas que aún leen
> ese campo. Código nuevo debe usar `error.message`.

---

## 9. Base de datos y migraciones

46 migraciones en `migrations/`, con el formato `NNN_descripcion.sql`.

### Control de estado con checksum

La tabla `schema_migrations(version, name, checksum, applied_at, applied_by)`
registra lo aplicado. `run_migrations.py`:

- Aplica **solo lo pendiente**. Reejecutarlo no duplica nada.
- Verifica el **SHA-256** de cada migración ya aplicada. Si alguien editó un
  archivo que ya corrió, aborta y lo dice (regla 3).
- Corre cada migración en **su propia transacción**: entra entera o no entra.

```bash
python run_migrations.py               # aplica lo pendiente
python run_migrations.py --dry-run     # muestra el plan sin tocar nada
python run_migrations.py --verify-only # solo comprueba checksums
python run_migrations.py --adopt       # registra lo existente SIN ejecutarlo
python run_migrations.py --strict      # falla con código != 0 (para CI)
```

`--adopt` existe para bases que ya estaban al día antes de tener la tabla de
control: las registra sin volver a ejecutarlas.

### Migraciones destacadas

| Nro | Qué hace |
|---|---|
| 000 | Esquema base completo |
| 001 · 005 | Roles, permisos, estructura RBAC |
| 009 | Logística avanzada (almacenes, lotes, herramientas) |
| 011 · 014 | Cotizaciones APU, clientes |
| 020 · 023 | Planificación, aprobaciones de gerencia |
| 034 · 035 | Preferencias de usuario, marca blanca |
| 037 | Seguridad: eliminación de contraseña en texto plano |
| 038 · 040 | Multi-base de datos, permisos por bloque |
| 043 | 4º token de color |
| 044 | Repara 8 permisos de logística huérfanos |

**La 044 arregla un bug real** que encontró `test_rbac_matrix`: 19 endpoints de
logística avanzada (lotes, transferencias, inventario físico, valuación)
exigían permisos que no existían en la tabla `permissions` ni tenía ningún rol.
Devolvían 403 a **todo el mundo**, incluido el Administrador Maestro. La
migración 009 creó las tablas pero nunca registró los permisos.

### Backups

Workflow `.github/workflows/backup.yml`, cron diario a las 02:00 de Lima:

1. `pg_dump --format=custom` de producción.
2. Cifrado con **GPG AES-256** antes de subirlo como artefacto (30 días).
3. Un segundo job **restaura el volcado en un PostgreSQL vacío**, verifica con
   un conteo real que los datos llegaron, y corre la suite completa contra la
   copia restaurada.

> Un backup que nunca se restauró no es un backup: es una esperanza.

---

## 10. Tests y CI

175 tests en `tests/`. Cobertura de backend **31.18 %**, con un umbral mínimo
de 30 % que el CI hace cumplir (`fail_under` en `pyproject.toml`). Es un
trinquete: sube, nunca baja.

| Archivo | Qué cubre |
|---|---|
| `test_auth.py` | Login, refresh, logout, rotación de tokens, token forjado, flujo 401→refresh |
| `test_rbac_matrix.py` | Deny-by-default y matriz roles × permisos |
| `test_beta_gate.py` | Lanzamiento por fases (52 tests) |
| `test_db_pool.py` | Que no se fuguen conexiones ante excepciones |
| `test_errors.py` | Sobre único de errores, que no se filtre el traceback |
| `test_health.py` | Que `/health` devuelva 503 si la base de datos cae |
| `test_storage.py` | Validación y re-encodeo de archivos subidos |
| `test_migrations.py` | Checksums y detección de migraciones editadas |
| `test_seguridad_login.py` | Rate limiting, bloqueo por usuario, cabeceras, CORS |
| `tests/smoke/` | Endpoints críticos de punta a punta |

Las credenciales de los tests **se leen del entorno**, nunca del código. Sin
ellas, los tests que necesitan sesión se **omiten** en vez de fallar.

### Pipeline (`.github/workflows/ci.yml`)

Corre en cada push y cada PR. Tres jobs:

| Job | Qué hace |
|---|---|
| **Barrido de secretos** | `gitleaks` sobre el historial completo |
| **Backend** | `ruff` → migraciones desde cero sobre PostgreSQL 16 efímero → siembra de usuarios → `pytest` con umbral de cobertura |
| **Frontend** | `npm ci` → `eslint` → `vite build` |

`main` está protegida: los 3 checks tienen que estar verdes y hace falta un PR.

### La línea base del trinquete

El código heredado arrastraba hallazgos de linter. En vez de bloquear el CI de
golpe o desactivar las reglas y perderlas:

- **ruff** (`E9`, `F`, `B`) quedó **limpio** tras corregir 37 hallazgos.
- **eslint** arrastraba 83 problemas: se degradaron a *warning* y el CI corre
  con `--max-warnings 83`. El número solo puede bajar.

Cada vez que un grupo de reglas queda en cero, se sube a error y ya no se
puede retroceder.

---

## 11. Cómo levantar el proyecto en local

### Requisitos

- Python 3.11
- Node.js 20
- Acceso a una base de datos PostgreSQL

### Backend

```powershell
# 1. Entorno virtual (ya existe en venv/)
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt

# 2. Configuración
copy .env.example .env
# Edita .env: DATABASE_URL y SECRET_KEY son obligatorias

# 3. Migraciones
.\venv\Scripts\python.exe run_migrations.py

# 4. Usuarios (imprime contraseñas aleatorias una sola vez)
.\venv\Scripts\python.exe scripts\seed_users.py

# 5. Arrancar
.\venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

El backend **no arranca** si falta `DATABASE_URL` o `SECRET_KEY`: muere con un
mensaje que dice exactamente qué falta, en vez de fallar raro más tarde.

### Frontend

```powershell
cd frontend\myapp
npm install
npm run dev
```

Sin `VITE_API_URL` apunta a `http://127.0.0.1:8000`.

### Compuerta de verificación

```powershell
.\verify.ps1
```

Comprueba que el backend importa, que los smoke tests pasan y que el frontend
compila. **Nada se considera terminado sin que esto quede en verde.**

### Scripts útiles

| Script | Para qué |
|---|---|
| `scripts/rotate_admin_password.py` | Rota la contraseña de un usuario a una aleatoria fuerte. La imprime una sola vez |
| `scripts/generate_superadmin_hash.py` | Genera el par usuario/hash del superadmin para el gestor de secretos |
| `scripts/seed_users.py` | Siembra los usuarios base con contraseñas aleatorias |
| `scripts/seed_ci_users.py` | Siembra los usuarios que necesita la suite en CI |
| `scripts/migrar_logos_a_storage.py` | Mueve logos y avatares del disco local a Supabase Storage |
| `scripts/sentry_smoke.py` | Envía una excepción de prueba para validar Sentry |

---

## 12. Cómo se despliega

```
commit → push a una rama → Pull Request → CI (3 checks) → merge a main
                                                              │
                                        ┌─────────────────────┴──────────────┐
                                        ▼                                    ▼
                              Vercel (frontend, ~2 min)          Render (backend, ~3-5 min)
```

`main` está protegida: **no se puede empujar directamente**. El despliegue lo
dispara el merge del PR, no el push.

Si hay migraciones nuevas, se ejecutan aparte con `run_migrations.py` contra
Supabase. **Regla:** una migración corre en staging antes que en producción.

### Entorno de staging

`render.yaml` declara dos servicios espejo: `erp-backend` sobre `main`
(producción) y `erp-backend-staging` sobre la rama `staging`, con su **propia**
base de datos y un `SECRET_KEY` distinto, para que un token de staging no valga
en producción. En staging `MODULOS_BETA` está vacío: todo abierto, es donde se
prueban los módulos sin soltar.

El servicio de staging **todavía no está creado** en Render.

---

## 13. Variables de entorno

Todas están declaradas y validadas en `app/core/config.py`. Nadie llama a
`os.getenv()` fuera de ese archivo. La plantilla completa, con valores de
ejemplo falsos, está en `.env.example`.

### Obligatorias

| Variable | Sin ella |
|---|---|
| `DATABASE_URL` | El backend no arranca |
| `SECRET_KEY` | El backend no arranca. Mínimo recomendado 32 caracteres: si es más corta, avisa ruidosamente en los logs pero arranca |

### Opcionales (sin ellas la funcionalidad queda apagada)

| Variable | Sin ella |
|---|---|
| `ENV` | Asume `development`: sin HSTS, CSP relajada, `/docs` visible |
| `CORS_ORIGINS` | El frontend no puede llamar al API en producción |
| `SENTRY_DSN` / `VITE_SENTRY_DSN` | Sin telemetría de errores |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Los logos y avatares se pierden en cada redeploy |
| `MODULOS_BETA` | Todos los módulos visibles para todos |
| `BETA_TESTERS` | Nadie puede ver los módulos en beta |
| `SUPERADMIN_USERNAME` + `SUPERADMIN_PASSWORD_HASH` | No hay acceso de superadmin |
| `DATABASE_URL_BACKUP` + `BACKUP_PASSPHRASE` | El backup diario falla |

**Importante:** las variables de entorno son **por entorno**. Tu `.env` local y
las de Render son independientes. Un hash de superadmin que funciona en local
no funciona en el sitio desplegado si allí hay otro valor.

---

## 14. Mapa de ramas

```
main  ee8e686  ← lo que está en vivo
  │
  ├── fase-0-endurecimiento  e513206   PR abierto
  │     │
  │     └── logistica-primero  dd9132b  PR abierto (rebasada sobre la Fase 0)
  │
  ├── staging  ee8e686
  ├── docs-proyecto                     esta documentación
  ├── 001-export-filtro-responsable     histórica
  ├── 002-tema-apariencia               histórica
  └── 003-marca-configurable            histórica
```

Orden de merge recomendado: **Fase 0 primero**, comprobar que el sitio sigue
sano, y después el lanzamiento por fases. Si algo rompe, así sabes cuál de los
dos fue.

---

## 15. Deuda técnica y limitaciones conocidas

Ordenada por lo que más duele.

### Bloqueantes

| Problema | Detalle |
|---|---|
| **Nada de esto está desplegado** | `main` lleva meses sin moverse. Todo el endurecimiento y el lanzamiento por fases esperan en PRs |
| **La contraseña del superadmin está en el historial de git** | Estuvo escrita en `tests/smoke/test_endpoints.py`. El historial es para siempre: **hay que rotarla** con `scripts/generate_superadmin_hash.py` y actualizar las variables en Render |
| **200 rutas sin permiso RBAC** | Cualquier usuario con sesión puede llamarlas. Trinquete puesto, pero cerrarlas es una spec propia |

### Importantes

| Problema | Detalle |
|---|---|
| **Logos efímeros** | Hasta configurar Supabase Storage, se pierden en cada redeploy de Render |
| **Backup sin estrenar** | El workflow existe pero el primer simulacro de restauración no se ha corrido. Hasta entonces, no hay backup verificado |
| **Staging inexistente** | `render.yaml` lo declara pero el servicio no está creado |
| **Sentry sin DSN** | El código está, falta crear los proyectos y cargar los DSN |
| **Monitor externo** | UptimeRobot sobre `/health` sin configurar. Además de avisar de caídas, reduce los cold starts |

### Menores

| Problema | Detalle |
|---|---|
| **Cold start de 30-60 s** | Render free tier tras inactividad |
| **83 warnings de eslint** | Congelados como línea base; solo pueden bajar |
| **33 `raise ... from`** | Siguiente escalón del trinquete de ruff (`B904`) |
| **Bundle de 2 MB** | El frontend no hace code splitting |
| **Usuario con espacio** | `Wilfredo Flores` tiene espacio y mayúsculas en el username, incómodo de teclear en el login |
| **Contador de login en memoria** | El bloqueo por usuario vive en el proceso. Con más de una instancia habrá que moverlo a Redis |
| **Módulo Finance** | En desarrollo |

---

## 16. El proceso de trabajo (SDD)

Spec-Driven Development. Cada funcionalidad se documenta antes de codificarse.

```
/speckit-specify   → spec.md      QUÉ queremos y por qué
/speckit-plan      → plan.md      CÓMO lo haremos
/speckit-tasks     → tasks.md     PASOS ejecutables
/speckit-implement → código       EJECUTAR
/speckit-verify    → checklist    VALIDAR
```

Las specs viven en `specs/` (features 001-009) y `zeit_specs/specs/`
(F-000 en adelante). 16 specs en total.

### Definition of Done

Una feature no está terminada hasta que:

- [ ] La spec refleja lo realmente construido.
- [ ] Cada criterio de aceptación tiene un test en verde que lo nombra.
- [ ] La matriz RBAC incluye los permisos nuevos y `test_rbac_matrix` pasa.
- [ ] Las escrituras generan auditoría, verificado por test.
- [ ] La migración corrió en **staging antes que en producción**.
- [ ] Sentry no muestra errores nuevos tras 48 h.
- [ ] El documento de alcance está actualizado.

### Checklist de cada sesión

- [ ] Leer `CONSTITUTION.md` y la spec activa antes de escribir código.
- [ ] Confirmar en qué tarea se trabaja y que sus dependencias están hechas.
- [ ] Correr la suite antes y después.
- [ ] Ningún secreto en el diff, revisado explícitamente.
- [ ] Commit con referencia a la tarea: `feat(finance): T-04 registrar pago`.
- [ ] Marcar la tarea con evidencia (nombre del test o captura).

---

## 17. Índice del resto de documentos

Este archivo cubre todo lo esencial. Los demás existen por razones históricas y
hay solapamiento entre ellos.

| Documento | Para qué sirve | Estado |
|---|---|---|
| **`PROYECTO_COMPLETO.md`** | **Este archivo. Punto de entrada único** | Al día |
| `MIGRAR_A_OTRA_PC.md` | Mudar el proyecto a otra máquina sin perder nada | Al día |
| `zeit_specs/CONSTITUTION.md` | Las 8 reglas de oro y el proceso. **Fuente de verdad** | Al día |
| `zeit_specs/specs/000-fase-0-endurecimiento/` | Spec, tareas y evidencia del endurecimiento | Al día |
| `zeit_specs/specs/000-fase-0-endurecimiento/runbook-manual.md` | Los 9 pasos de consola externa pendientes | Al día |
| `zeit_specs/specs/001-lanzamiento-por-fases/spec.md` | Spec del lanzamiento por fases | Al día |
| `PROYECTO_ZEIT_OVERVIEW.md` | Resumen ejecutivo más corto | Solapa con este |
| `README.md` | Instalación y arranque | Parcialmente desactualizado |
| `COLLABORATION.md` | Historial largo de sesiones de trabajo | Histórico |
| `DOCUMENTATION.md` | Notas técnicas antiguas | Desactualizado |
| `PROYECTO.md` | Notas iniciales del proyecto | Desactualizado |
| `specs/00X-*/` | Specs de las features 001 a 009 | Histórico |

> **Sugerencia:** `DOCUMENTATION.md` y `PROYECTO.md` están desactualizados y su
> contenido útil ya vive aquí. Borrarlos reduciría la confusión, pero es una
> decisión del director técnico.

---

*Documento mantenido por Claude Code · ZEIT Solutions ERP*
