# Data Model: Control de Acceso por Bloques

**Feature**: 008-control-acceso-bloques
**Date**: 2026-06-30

---

## Entidad nueva: `user_block_permissions`

Persiste la relación usuario ↔ bloque con su nivel de acceso.

| Columna      | Tipo            | Restricciones                                               |
|--------------|-----------------|-------------------------------------------------------------|
| `id`         | UUID            | PK, DEFAULT gen_random_uuid()                               |
| `user_id`    | UUID            | FK → `users.id` ON DELETE CASCADE, NOT NULL                 |
| `block_slug` | VARCHAR(30)     | CHECK IN ('logistica','operaciones','administracion','gerencia'), NOT NULL |
| `level`      | VARCHAR(10)     | CHECK IN ('view','edit'), NOT NULL                          |
| `granted_by` | UUID            | FK → `users.id`, NULLABLE (NULL = sistema/superadmin env)  |
| `granted_at` | TIMESTAMP       | DEFAULT NOW()                                               |

**Índice único:** `(user_id, block_slug)` — un usuario solo puede tener una asignación
por bloque. Si se cambia el nivel, se hace UPDATE, no INSERT adicional.

**Auditoría:** los cambios a esta tabla se capturan automáticamente por
`AuditMiddleware` (operaciones PUT/DELETE). No se necesita tabla de historial adicional.

---

## Bloques de acceso (catálogo fijo, no en DB)

Los 4 bloques son constantes del sistema, definidos en código:

| slug            | Label visible   | Módulos MODULES[] en Layout       |
|-----------------|-----------------|-----------------------------------|
| `logistica`     | Logística       | `logistics`                       |
| `operaciones`   | Operaciones     | `operations`                      |
| `administracion`| Administración  | `admin`, `administracion`         |
| `gerencia`      | Gerencia        | `gerente`                         |

---

## Cambios en entidades existentes

### `users` (sin cambios de esquema)

Solo se añade la relación `user_block_permissions`. Los campos existentes no se
modifican.

### JWT payload (extensión)

Se añade el campo `blocks` al token de acceso:

```json
{
  "sub": "uuid",
  "permissions": ["admin:users:read", "..."],
  "primary_module": "admin",
  "modules": ["admin", "administracion"],
  "blocks": [
    { "slug": "administracion", "level": "edit" },
    { "slug": "logistica", "level": "view" }
  ],
  "iat": 1234567890,
  "exp": 1234567890
}
```

El campo `modules` se mantiene (backward compat). El frontend usará `blocks` para
el renderizado. Superadmin: `blocks = []` (no usa tabla) — Layout detecta
`role === "superadmin"` y muestra todo.

### `localStorage` (frontend)

Se añade la clave `blocks` almacenada en login/refresh:
```js
localStorage.setItem("blocks", JSON.stringify(blocksArray));
```

---

## Relaciones

```
users (1) ──────────── (N) user_block_permissions
                              ├── user_id → users.id
                              ├── block_slug ∈ {'logistica','operaciones','administracion','gerencia'}
                              └── level ∈ {'view','edit'}
```

---

## Reglas de negocio de datos

1. Un usuario puede tener 0 a 4 filas (máximo una por bloque).
2. `granted_by` puede ser NULL si la asignación fue hecha por el superadmin de entorno
   (cuyo `id = "superadmin"` no existe en la tabla `users`).
3. Si se elimina un usuario, sus asignaciones se eliminan en cascada.
4. El superadmin no tiene filas en esta tabla. Acceso total determinado por `role=superadmin` en JWT.
5. Un usuario sin filas en esta tabla ve el dashboard vacío con mensaje de "sin acceso".
6. La función `get_user_blocks(user_id)` devuelve lista vacía `[]` si no hay filas (no error).

---

## Script de migración: `040_user_block_permissions.sql`

```sql
-- 040_user_block_permissions.sql
-- Tabla de asignación explícita de bloques de acceso por usuario

CREATE TABLE IF NOT EXISTS user_block_permissions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    block_slug  VARCHAR(30) NOT NULL
                CHECK (block_slug IN ('logistica', 'operaciones', 'administracion', 'gerencia')),
    level       VARCHAR(10) NOT NULL CHECK (level IN ('view', 'edit')),
    granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    granted_at  TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, block_slug)
);

CREATE INDEX IF NOT EXISTS idx_user_block_permissions_user_id
    ON user_block_permissions (user_id);
```
