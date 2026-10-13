# Mudar el proyecto a otra PC

Guía para dejar de trabajar en una máquina y seguir en otra sin perder nada.

**Lee esto ANTES de formatear o devolver la PC vieja.**

---

## La idea en una frase

GitHub tiene **todo el código**. Lo único que NO está ahí, y que no se puede
recuperar de ningún sitio, es el archivo **`.env`** con tus contraseñas. Ese lo
tienes que llevar a mano.

---

## 1. Antes de apagar la PC vieja

### Comprueba que no queda nada sin subir

```powershell
cd D:\PROYECTOS\ERP_MODULO\erp-modular
git status
git log --branches --not --remotes --oneline
```

- `git status` debe decir que no hay cambios pendientes (los archivos en
  `??` sin rastrear son normales: son carpetas ignoradas).
- El segundo comando debe **no imprimir nada**. Si imprime algo, son commits
  que existen solo en tu PC: súbelos con `git push --all origin`.

### Guarda el `.env` en tu gestor de contraseñas

Este es **el paso que no te puedes saltar**. Abre `.env` y guarda su contenido
en tu gestor de contraseñas (Bitwarden, 1Password, el que uses) como una nota
segura.

Contiene 12 variables, y estas tres son imprescindibles para que el proyecto
arranque:

| Variable | Qué es |
|---|---|
| `DATABASE_URL` | La cadena de conexión a tu base de datos en Supabase |
| `SECRET_KEY` | La clave que firma las sesiones |
| `SUPERADMIN_PASSWORD_HASH` | El acceso de superadmin |

> **No lo mandes por WhatsApp, correo ni Telegram.** Esas conversaciones se
> guardan en servidores ajenos y quedan ahí para siempre. Usa el gestor de
> contraseñas, o una memoria USB que luego borres.
>
> Si lo pierdes: `DATABASE_URL` se recupera del panel de Supabase, y
> `SECRET_KEY` y el hash del superadmin se pueden generar de nuevo (al
> cambiarlos se cierran todas las sesiones abiertas, nada más).

---

## 2. Qué copiar y qué NO copiar

**Recomendación: no copies la carpeta.** Clona desde GitHub en la PC nueva y
lleva solo el `.env`. Es más rápido y más limpio.

### NO copies estas carpetas

| Carpeta | Por qué no |
|---|---|
| `venv/` | **627 MB y además no funcionaría.** Tiene grabada dentro la ruta de la PC vieja (`C:\Users\ALIEN\...`). Se recrea en un comando |
| `node_modules/` | Se recrea con `npm install`. Puede tener binarios de esta máquina |
| `__pycache__/`, `.pytest_cache/`, `.ruff_cache/` | Basura temporal |
| `.coverage` | Se regenera al correr los tests |
| `ECC/` | Toolkit de terceros, se reinstala si lo quieres |
| `app/storage/` | Logos y avatares subidos. En el servidor son efímeros de todas formas |

### SÍ lleva estos archivos

| Archivo | Por qué |
|---|---|
| **`.env`** | **Imprescindible.** No está en GitHub ni se puede recuperar |
| `.claude/settings.local.json` | Opcional: tus permisos personales de Claude Code |

---

## 3. En la PC nueva

### Instala lo necesario

| Programa | Versión | Dónde |
|---|---|---|
| Python | **3.11** | https://www.python.org/downloads/ |
| Node.js | **20 o superior** | https://nodejs.org/ |
| Git | cualquiera | https://git-scm.com/ |

> Python **3.11** concretamente. El proyecto está fijado a esa versión
> (`target-version = "py311"`), y versiones más nuevas pueden romper alguna
> dependencia.
>
> Al instalar Python, marca la casilla **"Add Python to PATH"**.

### Clona el proyecto

```powershell
cd D:\PROYECTOS\ERP_MODULO
git clone https://github.com/cesarcov/PROYECTO_ZEIT.git erp-modular
cd erp-modular
```

### Trae todas las ramas

El clon solo trae `main`. Para tener las demás:

```powershell
git fetch --all
git branch -r
```

Deberías ver 8 ramas. Para trabajar en una:

```powershell
git checkout logistica-primero
```

### Coloca el `.env`

Crea el archivo `.env` en la raíz del proyecto y pega el contenido que
guardaste en el gestor de contraseñas.

Si no lo tienes, parte de la plantilla y rellena los valores:

```powershell
copy .env.example .env
```

### Backend

```powershell
python -m venv venv
.\venv\Scripts\python.exe -m pip install --upgrade pip
.\venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

### Frontend

```powershell
cd frontend\myapp
npm install
cd ..\..
```

---

## 4. Comprueba que funciona

En este orden. Si uno falla, para y arregla antes de seguir.

```powershell
# 1. El backend importa y la configuración es válida
.\venv\Scripts\python.exe -c "import app.main; print('OK')"

# 2. Conecta de verdad con la base de datos y cuenta los usuarios
.\venv\Scripts\python.exe -c "from app.core.database import db_connection as c; conn=c().__enter__(); cur=conn.cursor(); cur.execute('SELECT count(*) FROM users'); print('BD OK -', cur.fetchone()[0], 'usuarios')"

# 3. Las migraciones están al día
#    (el flag --verify-only existe desde la Fase 0; en `main` todavía no)
.\venv\Scripts\python.exe run_migrations.py --verify-only

# 4. Los tests pasan
.\venv\Scripts\python.exe -m pytest -q

# 5. El frontend compila
cd frontend\myapp
npm run lint
npm run build
cd ..\..
```

### Qué deberías ver

| Comando | Resultado esperado |
|---|---|
| 1 | `OK` |
| 2 | `BD OK - 8 usuarios` |
| 3 | `Checksums verificados: 46 migración(es) registrada(s), sin alteraciones`. Si estás en `main`, este flag aún no existe: sáltalo |
| 4 | Los tests pasan; algunos se **omiten** (`skipped`) si no pusiste las variables `TEST_*`. Eso es normal |
| 5 | `0 errors`, hasta 83 warnings (es la línea base), y `✓ built` |

### Si algo falla

| Síntoma | Causa probable |
|---|---|
| `ARRANQUE ABORTADO - configuracion de entorno invalida` | Falta `DATABASE_URL` o `SECRET_KEY` en el `.env`. El mensaje dice cuál |
| `AVISO DE SEGURIDAD ... SECRET_KEY ... DEBIL` | Arranca igual. Tu clave es corta; conviene generar una nueva |
| Error de autenticación con PostgreSQL | La contraseña del `DATABASE_URL` está mal, o Supabase cambió la cadena de conexión |
| `ModuleNotFoundError` | Faltó `pip install -r requirements-dev.txt`, o estás usando el Python del sistema en vez del del `venv` |

---

## 5. Lo que NO cambia con la mudanza

Esto vive en servidores, no en tu PC, así que sigue igual:

- La **base de datos** en Supabase, con todos tus datos.
- El **sitio desplegado** en Vercel y Render.
- Las **variables de entorno de producción** en el panel de Render (son
  independientes de tu `.env` local).
- Todo el **código y el historial** en GitHub.

---

## 6. Dónde retomar el trabajo

Al llegar a la PC nueva, lee `PROYECTO_COMPLETO.md`: tiene el estado real del
proyecto, el mapa de ramas y la deuda pendiente.

En resumen, lo que estaba a medias:

| Pendiente | Dónde |
|---|---|
| 3 Pull Requests sin mergear (documentación, Fase 0, lanzamiento por fases) | GitHub |
| 9 pasos de consola externa de la Fase 0 | `zeit_specs/specs/000-fase-0-endurecimiento/runbook-manual.md` |
| Rotar la contraseña del `admin` (está perdida) | `scripts/rotate_admin_password.py` |
| Rotar la contraseña del superadmin (está en el historial de git) | `scripts/generate_superadmin_hash.py` |

---

## Resumen en 6 pasos

1. En la PC vieja: `git status` limpio y `git log --branches --not --remotes` vacío.
2. Guarda el `.env` en tu gestor de contraseñas.
3. En la PC nueva: instala Python 3.11, Node 20 y Git.
4. `git clone` + `git fetch --all`.
5. Coloca el `.env`, crea el `venv`, `pip install`, `npm install`.
6. Corre las 5 comprobaciones de la sección 4.

**Lo único irrecuperable es el `.env`. Todo lo demás se vuelve a bajar o a construir.**
