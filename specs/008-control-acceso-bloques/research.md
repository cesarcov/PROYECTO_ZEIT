# Research: Control de Acceso por Bloques

**Feature**: 008-control-acceso-bloques
**Date**: 2026-06-30

---

## Hallazgos del Codebase

### 1. Sistema de módulos actual (frágil)

**Hallazgo:** `app/core/security/auth.py` — función `_compute_modules()` — deriva los
módulos accesibles a partir de los nombres de rol con comparación de strings:

```python
if any("Maestro" in r for r in role_names):
    modules.append("admin")
if any("Gerente General" in r for r in role_names):
    modules.append("gerente")
# ...
```

**Problema:** Si un rol se renombra (ej. "Administrador Maestro" → "Admin TI"), la
lógica se rompe silenciosamente. La asignación no es explícita, es inferida.

**Decisión:** Reemplazar `_compute_modules` con lectura de la nueva tabla
`user_block_permissions`. Mantener compatibilidad backward: si un usuario no tiene
filas en la tabla, caer al cómputo actual (para no romper usuarios existentes durante
la transición).

---

### 2. Payload del JWT — campo `modules`

**Hallazgo:** `create_access_token()` ya incluye `modules: list[str]` en el JWT:
```python
payload = {
    "sub": user_id,
    "permissions": permissions,
    "primary_module": primary_module,
    "modules": modules or [primary_module],
    ...
}
```

**Decisión:** Añadir un campo `blocks` al JWT: lista de objetos
`{slug, level}` derivados de `user_block_permissions`. El campo `modules` existente
se mantiene por compatibilidad backward (Layout.jsx lo usa en `auth.modules`). En
paralelo, el frontend adoptará `auth.blocks` para el renderizado del sidebar. Cuando
todos los usuarios tengan asignaciones explícitas, `modules` puede deprecarse.

---

### 3. Frontend — Layout.jsx y la lógica `visibleModules`

**Hallazgo clave (línea 418-419 de Layout.jsx):**
```js
const userModules = auth.modules || [auth.role];
const visibleModules = MODULES.filter((m) => userModules.some(r => m.roles.includes(r)));
```

La comparación usa el campo `roles` de cada módulo en la constante `MODULES`:
- `logistics` → roles: `["admin", "logistics"]`
- `operations` → roles: `["admin", "operations"]`
- `admin` → roles: `["admin"]`
- `administracion` → roles: `["administracion"]`
- `gerente` → roles: `["admin", "gerente"]`

**Origen del ghost button:** si `auth.modules = ["admin", "administracion"]` pero el
usuario no tiene permisos reales en el endpoint `gerente`, el módulo `gerente` no
aparece. PERO si el rol tiene inconsistencias (ej. `modules: ["admin"]` por el
heurístico, y en BD el usuario no tiene scope `gerente`), puede verse "Gerencia" en
el sidebar pero recibir 403 al navegar.

**Decisión:** La solución definitiva es que `visibleModules` se filtre con `auth.blocks`
(nuevo campo del JWT/API), no con `auth.modules`. El campo `blocks` contiene las 4
slugs de bloque (`operaciones`, `administracion`, `logistica`, `gerencia`) con sus
niveles (`view`/`edit`), asignados explícitamente por el superadmin.

---

### 4. Mapeo: bloques nuevos → módulos MODULES[] del Layout

| Bloque (nuevo slug) | Módulos MODULES[] que agrupa |
|---------------------|------------------------------|
| `logistica`         | `logistics`                  |
| `operaciones`       | `operations`                 |
| `administracion`    | `admin`, `administracion`    |
| `gerencia`          | `gerente`                    |

Los bloques son 4 (fijos). Cada bloque activa 1 o 2 entradas del array `MODULES[]`.
El nivel `view` vs `edit` se usa para mostrar/ocultar botones de escritura dentro
del bloque.

---

### 5. Módulo superadmin ya existe (feature 007)

**Hallazgo:** `app/modules/superadmin/router.py` ya tiene `require_superadmin` como
dependencia. Los nuevos endpoints de gestión de bloques se añaden en este mismo
módulo (router, service, schemas).

**Decisión:** Extender `app/modules/superadmin/` con:
- `GET /superadmin/users` — lista de usuarios con sus bloques actuales
- `GET /superadmin/users/{user_id}/blocks` — bloques de un usuario específico
- `PUT /superadmin/users/{user_id}/blocks` — reemplazar todas las asignaciones

No se crea un módulo separado. Esto mantiene la cohesión y reutiliza `require_superadmin`.

---

### 6. Frontend — hook `useAuth.js`

**Hallazgo:** `useAuth.js` lee `modules` de:
1. `localStorage.getItem("modules")` (guardado en login)
2. `payload.modules` del JWT
3. `[role]` como fallback

**Decisión:** En el login response, añadir `blocks` (lista de `{slug, level}`) al
localStorage. El hook `useAuth` los expone como `auth.blocks`. Layout.jsx los usa
para filtrar `visibleModules` y para pasar `blockLevel` a los componentes hijo.

---

### 7. Tabla de migración

**Decisión (modelo de datos):**
```sql
CREATE TABLE user_block_permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_slug  VARCHAR(30) NOT NULL
              CHECK (block_slug IN ('logistica','operaciones','administracion','gerencia')),
  level       VARCHAR(10) NOT NULL CHECK (level IN ('view','edit')),
  granted_by  UUID REFERENCES users(id),
  granted_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, block_slug)
);
```

Número de migración siguiente: **040** (la 039 es `user_avatar`).

---

### 8. Refresh token — propagación de bloques

**Hallazgo:** `rotate_refresh_token()` llama a `get_user_modules()` y
`get_user_permissions()`. El nuevo JWT renovado también necesita `blocks`.

**Decisión:** Añadir función `get_user_blocks(user_id)` en `auth.py` que consulta
`user_block_permissions`. Llamarla en `rotate_refresh_token` y en el login.

---

## Alternativas descartadas

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| Permisos por rol en lugar de por usuario | El usuario quiere control individual por persona, no por grupo |
| Nivel granular por sub-módulo (por ruta) | Demasiada complejidad para esta versión; los 4 bloques cubren el 100% del caso de uso |
| Guardar bloques solo en `permissions` (scopes) | Los scopes son granulares por endpoint; los bloques son para visibilidad UI — capas distintas |
| Gestión en panel de admin existente | El superadmin (TI) necesita control separado del admin de empresa |

---

## Resolución de NEEDS CLARIFICATION

No hubo markers de NEEDS CLARIFICATION en la spec. Todos los detalles técnicos se
resuelven aquí sin bloquear la spec.
