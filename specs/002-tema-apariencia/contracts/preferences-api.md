# API Contract: Preferencias del usuario

**Phase 1** · Branch `002-tema-apariencia` · 2026-06-20

Endpoints nuevos para guardar/leer las preferencias del usuario autenticado (donde vive el tema). Auth: `get_current_user` (cualquier usuario autenticado; sin permiso especial).

## GET /auth/me/preferences

Devuelve las preferencias del usuario actual.

**200 OK**
```json
{ "tema": "system", "compactTable": false, "pageSize": "30" }
```
- Si el usuario no tiene preferencias guardadas → `{}` (el frontend asume `tema: "system"`).
- `tema` ∈ `system | zeit-claro | zeit-oscuro | zeit-oscuro-energia | zeit-turquesa | zeit-grafito`.

## PUT /auth/me/preferences

Actualiza (merge) las preferencias del usuario actual.

**Request body**
```json
{ "tema": "zeit-oscuro" }
```

**Comportamiento**
- Hace **merge** con las preferencias existentes (no reemplaza todo el blob): solo cambia las claves enviadas.
- Valida que `tema` (si viene) sea uno de los valores permitidos; si no, responde `422`.

**200 OK** → devuelve las preferencias resultantes (igual forma que GET).

## Errores
- `401` si no hay sesión válida.
- `422` si `tema` tiene un valor no permitido.

## Contrato Frontend ↔ Backend
- El `ThemeProvider` lee las preferencias al iniciar sesión y escribe con `PUT` cuando el usuario cambia de tema.
- El frontend cachea `tema` en `localStorage["zeit_tema"]` para aplicar el tema antes del primer render (anti-parpadeo); la cuenta es la fuente de verdad.
