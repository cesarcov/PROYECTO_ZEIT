# API Contracts: Control de Acceso por Bloques

**Feature**: 008-control-acceso-bloques
**Date**: 2026-06-30

Todos los endpoints nuevos se añaden en `app/modules/superadmin/` y usan la
dependencia `require_superadmin` existente.

---

## Endpoints nuevos en `/superadmin`

### GET `/superadmin/users`

Lista todos los usuarios del sistema con sus bloques actualmente asignados.
Diseñado para la vista rápida del TI (US3).

**Auth:** JWT con `role=superadmin`

**Response 200:**
```json
[
  {
    "id": "uuid",
    "username": "frank_sonco",
    "email": "frank@zeit.pe",
    "is_active": true,
    "blocks": [
      { "slug": "logistica", "level": "edit" },
      { "slug": "operaciones", "level": "view" }
    ]
  },
  {
    "id": "uuid",
    "username": "juliet_alvis",
    "email": "juliet@zeit.pe",
    "is_active": true,
    "blocks": []
  }
]
```

---

### GET `/superadmin/users/{user_id}/blocks`

Obtiene los bloques asignados a un usuario específico. Usado al abrir el panel
de gestión de bloques de un usuario (US2).

**Auth:** JWT con `role=superadmin`

**Path params:** `user_id` (UUID)

**Response 200:**
```json
{
  "user_id": "uuid",
  "username": "frank_sonco",
  "blocks": [
    { "slug": "logistica",      "level": "edit",  "granted_at": "2026-06-30T10:00:00" },
    { "slug": "operaciones",    "level": "view",  "granted_at": "2026-06-30T10:00:00" },
    { "slug": "administracion", "level": null,    "granted_at": null },
    { "slug": "gerencia",       "level": null,    "granted_at": null }
  ]
}
```

Los 4 bloques siempre se devuelven. `level: null` significa no asignado.

**Response 404:**
```json
{ "detail": "Usuario no encontrado" }
```

---

### PUT `/superadmin/users/{user_id}/blocks`

Reemplaza completamente las asignaciones de bloque de un usuario.
Idempotente: enviar la misma lista dos veces produce el mismo estado.

**Auth:** JWT con `role=superadmin`

**Path params:** `user_id` (UUID)

**Request body:**
```json
{
  "blocks": [
    { "slug": "logistica",   "level": "edit" },
    { "slug": "gerencia",    "level": "view" }
  ]
}
```

- Para revocar todos los bloques: `"blocks": []`
- Para cambiar nivel: incluir el bloque con el nuevo nivel
- Bloques no incluidos en la lista son revocados

**Validaciones:**
- `slug` MUST estar en `['logistica','operaciones','administracion','gerencia']`
- `level` MUST estar en `['view','edit']`
- No se puede modificar el propio usuario superadmin (detectado por `role=superadmin` en JWT, no por ID)

**Response 200:**
```json
{
  "user_id": "uuid",
  "username": "frank_sonco",
  "blocks": [
    { "slug": "logistica", "level": "edit",  "granted_at": "2026-06-30T12:00:00" },
    { "slug": "gerencia",  "level": "view",  "granted_at": "2026-06-30T12:00:00" }
  ]
}
```

**Response 404:** Usuario no encontrado
**Response 422:** Slug o level inválido

---

## Cambios en endpoints existentes

### POST `/auth/login` — respuesta ampliada

El campo `blocks` se añade a la respuesta de login. El frontend lo guarda en
`localStorage` bajo la clave `blocks`.

**Response 200 (añadir campo):**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "token_type": "bearer",
  "primary_module": "admin",
  "modules": ["admin"],
  "blocks": [
    { "slug": "administracion", "level": "edit" },
    { "slug": "logistica",      "level": "view" }
  ]
}
```

Para el superadmin: `"blocks": "all"` (string especial que el frontend interpreta
como acceso total sin filtrado).

---

### POST `/auth/refresh` — respuesta ampliada

Idem login: añadir `blocks` para que el frontend actualice el localStorage en
cada rotación de token.

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "blocks": [ ... ]
}
```

---

### GET `/auth/me` — respuesta ampliada

Añadir `blocks` al perfil devuelto, para que el frontend pueda consultar permisos
sin re-decodificar el token.

```json
{
  "id": "uuid",
  "username": "frank_sonco",
  "email": "frank@zeit.pe",
  "avatar_url": null,
  "permissions": [...],
  "blocks": [
    { "slug": "logistica", "level": "edit" }
  ]
}
```

---

## Cambios en el JWT

El token de acceso incluye el nuevo campo `blocks`:

```json
{
  "sub": "user-uuid",
  "permissions": ["logistics:materials:view", "..."],
  "primary_module": "logistics",
  "modules": ["logistics"],
  "blocks": [
    { "slug": "logistica", "level": "edit" }
  ],
  "iat": 1234567890,
  "exp": 1234567890
}
```

Superadmin JWT: `"blocks": "all"` (string, no array — el frontend detecta esto
y no filtra módulos).

---

## Contratos de Frontend (localStorage)

| Clave           | Tipo             | Ejemplo |
|-----------------|------------------|---------|
| `access_token`  | string (JWT)     | `eyJ...` |
| `refresh_token` | string           | `abc...` |
| `role`          | string           | `"logistics"` |
| `modules`       | JSON array       | `["logistics"]` |
| `blocks`        | JSON array/`"all"` | `[{"slug":"logistica","level":"edit"}]` |
| `username`      | string           | `"frank_sonco"` |

---

## Constante de bloques (frontend y backend)

Definida en un solo lugar y compartida:

**Backend** (`app/core/blocks.py`):
```python
VALID_BLOCKS = ['logistica', 'operaciones', 'administracion', 'gerencia']
VALID_LEVELS = ['view', 'edit']

BLOCK_TO_MODULES = {
    'logistica':      ['logistics'],
    'operaciones':    ['operations'],
    'administracion': ['admin', 'administracion'],
    'gerencia':       ['gerente'],
}
```

**Frontend** (`src/constants/blocks.js`):
```js
export const BLOCKS = [
  { slug: 'logistica',      label: 'Logística',      modules: ['logistics'] },
  { slug: 'operaciones',    label: 'Operaciones',    modules: ['operations'] },
  { slug: 'administracion', label: 'Administración', modules: ['admin', 'administracion'] },
  { slug: 'gerencia',       label: 'Gerencia',       modules: ['gerente'] },
];
```
