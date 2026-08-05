# F-000 — Pasos manuales (consolas externas)

Todo el código de la Fase 0 está implementado y verificado en local. Lo que
sigue **no se puede automatizar desde el repositorio**: requiere tus
credenciales en consolas de terceros (GitHub, Supabase, Sentry, Render,
UptimeRobot) o escribe sobre la base de datos de producción.

Orden recomendado: 1 → 9.

---

## 0. Antes de nada: subir la rama

```powershell
git push -u origin fase-0-endurecimiento
```

Abre el PR contra `main`. El CI corre solo y debe quedar verde
(**valida T-06**). Hasta que este push exista, GitHub no conoce el workflow y
el paso 2 no puede completarse.

---

## 1. T-01 — Rotar credenciales *(escribe en producción)*

`admin/admin123` sigue siendo válido en la base de datos hasta que ejecutes
esto. **Córrelo tú, no yo**: la contraseña se imprime una sola vez y no debe
quedar en el historial de esta sesión.

```powershell
.\venv\Scripts\python.exe scripts\rotate_admin_password.py
```

Guarda la contraseña en tu gestor **antes de cerrar la terminal**. El script
revoca además todas las sesiones abiertas de ese usuario.

Para el superadmin (sus credenciales viven en variables de entorno, no en la BD):

```powershell
.\venv\Scripts\python.exe scripts\generate_superadmin_hash.py
```

Pega `SUPERADMIN_USERNAME` y `SUPERADMIN_PASSWORD_HASH` en Render → *Environment*.

Barrido de secretos ya ejecutado en esta sesión: **0 hallazgos en 53 commits**.
Para repetirlo:

```powershell
gitleaks detect --config .gitleaks.toml --redact
```

---

## 2. T-07 — Branch protection en `main`

GitHub → *Settings* → *Branches* → *Add branch protection rule*:

| Opción | Valor |
|---|---|
| Branch name pattern | `main` |
| Require a pull request before merging | ✔ (1 aprobación) |
| Require status checks to pass | ✔ |
| Status checks requeridos | `Backend (lint + migraciones + pytest)`, `Frontend (lint + build)`, `Barrido de secretos (gitleaks)` |
| Require branches to be up to date | ✔ |
| Do not allow bypassing | ✔ |

Los checks sólo aparecen en la lista **después** de que el CI haya corrido al
menos una vez (paso 0).

Equivalente por CLI:

```powershell
gh api -X PUT repos/cesarcov/PROYECTO_ZEIT/branches/main/protection `
  -F "required_status_checks[strict]=true" `
  -f "required_status_checks[contexts][]=Backend (lint + migraciones + pytest)" `
  -f "required_status_checks[contexts][]=Frontend (lint + build)" `
  -f "required_status_checks[contexts][]=Barrido de secretos (gitleaks)" `
  -F "enforce_admins=true" `
  -F "required_pull_request_reviews[required_approving_review_count]=1" `
  -F "restrictions=null"
```

---

## 3. T-12 — Adoptar el control de migraciones *(escribe en producción)*

La tabla `schema_migrations` ya existe (la creó el script al ejecutarse), pero
está vacía. Como la base **ya tiene** las 46 migraciones aplicadas, hay que
registrarlas sin volver a ejecutarlas:

```powershell
.\venv\Scripts\python.exe run_migrations.py --dry-run --adopt   # ver el plan
.\venv\Scripts\python.exe run_migrations.py --adopt             # ejecutarlo
```

A partir de ahí, `run_migrations.py` aplica sólo lo pendiente y detecta
cualquier migración ya aplicada que alguien edite después.

---

## 4. T-10 — Aplicar la migración 044 *(escribe en producción)*

`migrations/044_rbac_permisos_logistica_huerfanos.sql` repara un bug real que
detectó `test_rbac_matrix`: **19 endpoints de logística avanzada** (lotes,
transferencias, inventario físico, valuación) exigen permisos que no existían
en la tabla `permissions` ni tenía ningún rol. Hoy devuelven 403 a todo el
mundo, incluido el Administrador Maestro.

Revisa primero el reparto de permisos por rol en la cabecera del `.sql` — es
una decisión de negocio, no técnica. Luego:

```powershell
.\venv\Scripts\python.exe run_migrations.py --dry-run
.\venv\Scripts\python.exe run_migrations.py
```

Después de aplicarla, estos dos tests pasan a verde:

```powershell
.\venv\Scripts\python.exe -m pytest tests\test_rbac_matrix.py -q
```

---

## 5. T-11 — Buckets de Supabase Storage

Supabase → *Storage* → *New bucket*. Crea **dos**, ambos marcados **Public**:

| Bucket | Contenido |
|---|---|
| `branding` | Logos de marca (4 variantes) |
| `avatars` | Fotos de perfil |

Copia `Project URL` y la `service_role key` (Settings → API) a Render:

```
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_KEY=<service_role key>
```

> La `service_role key` salta las políticas RLS. Va **sólo** en variables de
> entorno del backend, nunca en el frontend ni en el repositorio.

Migra los archivos que hoy están en el disco efímero:

```powershell
.\venv\Scripts\python.exe scripts\migrar_logos_a_storage.py --dry-run
.\venv\Scripts\python.exe scripts\migrar_logos_a_storage.py
```

**Validación de OBJ-5:** sube un logo desde Admin → Marca, fuerza un redeploy
en Render y comprueba que el logo sigue ahí. `GET /health` debe responder
`"storage_persistente": true`.

---

## 6. T-04 — Sentry

1. [sentry.io](https://sentry.io) → dos proyectos: uno **Python/FastAPI**, otro **React**.
2. Backend, en Render: `SENTRY_DSN=<dsn del proyecto Python>`
3. Frontend, en Vercel: `VITE_SENTRY_DSN=<dsn del proyecto React>`

**Validación:**

```powershell
.\venv\Scripts\python.exe scripts\sentry_smoke.py
```

Imprime un `request_id`; búscalo en el panel filtrando por ese tag. Es el mismo
identificador que el usuario ve cuando le sale un error, así que un reporte de
"me salió el error abc123" se resuelve buscando ese tag.

---

## 7. T-05 — Monitor externo

[UptimeRobot](https://uptimerobot.com) → *Add New Monitor*:

| Campo | Valor |
|---|---|
| Monitor Type | HTTP(s) |
| URL | `https://erp-backend-00j7.onrender.com/health` |
| Monitoring Interval | 5 minutos |
| Alertas | tu correo |

Doble función: avisa cuando el servicio cae **y** actúa de keep-alive, que
reduce los cold starts de 30–60 s del plan gratuito de Render.

`/health` ya devuelve **503** cuando la base de datos no responde
(verificado por `tests/test_health.py`), así que el monitor detecta la caída
real en vez de ver un 200 mentiroso.

---

## 8. T-13 — Secretos del backup

GitHub → *Settings* → *Secrets and variables* → *Actions*:

| Secreto | Valor |
|---|---|
| `DATABASE_URL_BACKUP` | Cadena de conexión de **sólo lectura** a producción |
| `BACKUP_PASSPHRASE` | Frase larga y aleatoria para el cifrado GPG |

> Guarda `BACKUP_PASSPHRASE` **fuera de GitHub** (gestor de contraseñas). Sin
> ella el backup cifrado es un ladrillo.

**Primer simulacro (valida OBJ-6):** Actions → *Backup* → *Run workflow*. El job
`simulacro-restauracion` restaura el volcado en un Postgres vacío, comprueba que
los datos llegaron y corre la suite contra ellos. Si ese job queda verde, el
backup sirve de verdad.

---

## 9. T-15 — Entorno staging

```powershell
git checkout -b staging main
git push -u origin staging
```

1. **Supabase:** crea un proyecto NUEVO (o una base separada) para staging.
2. **Render:** *New +* → *Blueprint* → el repo. `render.yaml` ya declara
   `erp-backend-staging` sobre la rama `staging`. Rellena sus secretos con la
   base de staging, **nunca con la de producción**, y un `SECRET_KEY` distinto
   (así un token de staging no vale en producción).
3. **Vercel:** *Settings* → *Git* → añade `staging` como Preview Branch, con
   `VITE_API_URL` apuntando al backend de staging.
4. Prepara los datos:

```powershell
$env:DATABASE_URL="<url-de-staging>"
.\venv\Scripts\python.exe run_migrations.py
psql "<url-de-staging>" -f seed\demo.sql
$env:TEST_USER="demo"; $env:TEST_PASSWORD="<genera una>"
.\venv\Scripts\python.exe scripts\seed_ci_users.py
```

**Validación:** un push a `staging` despliega sin tocar producción.

A partir de aquí rige la Definition of Done: **toda migración corre en staging
antes que en producción**.

---

## Resumen de variables de entorno nuevas

Ninguna es obligatoria: sin ellas el sistema arranca igual, con la
funcionalidad correspondiente desactivada.

| Variable | Dónde | Sin ella |
|---|---|---|
| `ENV` | Render | Asume `development`: sin HSTS y con CORS local abierto |
| `SENTRY_DSN` | Render | Sin telemetría de backend |
| `VITE_SENTRY_DSN` | Vercel | Sin telemetría de frontend |
| `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` | Render | Los logos se pierden en cada redeploy |
| `CORS_ORIGINS` | Render | El frontend no puede llamar al API |
| `DATABASE_URL_BACKUP` + `BACKUP_PASSPHRASE` | GitHub Actions | El backup diario falla |

> **Importante para producción:** hoy `ENV` no está definido, así que el backend
> se comporta como *development*. En cuanto lo pongas a `production` se activan
> HSTS, la CSP estricta y el CORS cerrado, y se apagan `/docs` y `/redoc`.
