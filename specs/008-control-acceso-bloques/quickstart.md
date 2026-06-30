# Quickstart: Control de Acceso por Bloques

**Feature**: 008-control-acceso-bloques
**Date**: 2026-06-30

Guía de validación end-to-end para confirmar que la feature funciona correctamente.

---

## Prerequisitos

1. Backend corriendo en `http://127.0.0.1:8000`
2. Migración `040_user_block_permissions.sql` aplicada: `python run_migrations.py`
3. Superadmin configurado en `.env`: `SUPERADMIN_USERNAME` + `SUPERADMIN_PASSWORD_HASH`
4. Al menos un usuario no-superadmin existente en la DB (ej. `frank_sonco`)
5. Frontend corriendo: `npm run dev` (desde `frontend/myapp/`)

---

## Escenario 1 — Validar ghost buttons eliminados (US1, P1)

**Objetivo:** Un usuario sin bloque "Gerencia" no ve ese módulo en ningún lado.

### Paso 1.1 — Estado inicial (sin asignaciones)

```bash
# Obtener token del superadmin
curl -X POST http://127.0.0.1:8000/auth/login \
  -d "username=<SUPERADMIN_USERNAME>&password=<SUPERADMIN_PASSWORD>" \
  -H "Content-Type: application/x-www-form-urlencoded"
# Guarda el access_token → SA_TOKEN
```

```bash
# Confirmar que frank_sonco no tiene bloques
curl -H "Authorization: Bearer $SA_TOKEN" \
  http://127.0.0.1:8000/superadmin/users
# Debe mostrar frank_sonco con "blocks": []
```

### Paso 1.2 — Login con usuario sin bloques

1. Ir a la app en el navegador
2. Iniciar sesión como `frank_sonco`
3. **Resultado esperado:** Dashboard muestra mensaje "No tienes módulos asignados"
4. **Resultado esperado:** Sidebar izquierdo no tiene ningún módulo listado
5. **Verificación:** DevTools → Elements → buscar "Logística" o "Gerencia" → NO EXISTE en el DOM

---

## Escenario 2 — Asignar bloques desde la UI de Superadmin (US2, P2)

**Objetivo:** El TI asigna "Logística (editar)" y "Gerencia (ver)" a frank_sonco.

### Paso 2.1 — Asignar via API

```bash
# Obtener user_id de frank_sonco
curl -H "Authorization: Bearer $SA_TOKEN" \
  http://127.0.0.1:8000/superadmin/users
# Anotar el id de frank_sonco → FRANK_ID

# Asignar bloques
curl -X PUT \
  http://127.0.0.1:8000/superadmin/users/$FRANK_ID/blocks \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocks": [
    {"slug": "logistica", "level": "edit"},
    {"slug": "gerencia",  "level": "view"}
  ]}'
# Debe retornar 200 con los 2 bloques asignados
```

### Paso 2.2 — Verificar desde la UI de superadmin

1. Iniciar sesión como superadmin en el navegador
2. Navegar a la pantalla de gestión de bloques (SuperadminUserBlocks)
3. Seleccionar frank_sonco
4. **Resultado esperado:** Panel muestra 4 bloques; "Logística" = editar, "Gerencia" = ver;
   "Operaciones" y "Administración" = sin asignar

### Paso 2.3 — Verificar efecto en el usuario

1. Abrir nuevo navegador/incógnito → login como frank_sonco
2. **Resultado esperado:** Sidebar muestra SOLO "Logística" y "Gerencia"
3. **Resultado esperado:** "Operaciones" y "Administración" NO existen en pantalla
4. Navegar a Gerencia → verificar que puede ver pero no crear/editar (botones de escritura ausentes)
5. Navegar a Logística → verificar que puede crear y editar normalmente

---

## Escenario 3 — Revocar un bloque (US2)

**Objetivo:** Quitar "Gerencia" a frank_sonco.

```bash
curl -X PUT \
  http://127.0.0.1:8000/superadmin/users/$FRANK_ID/blocks \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocks": [{"slug": "logistica", "level": "edit"}]}'
# Debe retornar 200; solo 1 bloque activo
```

1. frank_sonco recarga la página
2. **Resultado esperado:** "Gerencia" ya no aparece en el sidebar
3. **Resultado esperado:** "Logística" sigue presente con nivel editar

---

## Escenario 4 — Vista rápida en lista de usuarios (US3, P3)

**Objetivo:** El TI puede ver bloques de todos los usuarios en una sola vista.

1. Login como superadmin → navegar a gestión de usuarios
2. **Resultado esperado:** Cada fila de usuario muestra chips/badges de sus bloques
3. frank_sonco → chip "Logística ✏" (editar)
4. juliet_alvis (sin bloques) → badge "Sin acceso" en color de advertencia

---

## Escenario 5 — Superadmin siempre tiene acceso total

1. Login como superadmin
2. **Resultado esperado:** Todos los módulos visibles en el sidebar
3. **Resultado esperado:** No hay restricciones de edición en ningún módulo

---

## Escenario 6 — Nivel view bloquea escritura en la API

**Objetivo:** Un usuario con nivel "view" en un bloque no puede escribir vía API.

```bash
# Asignar solo "view" en logística a frank_sonco
curl -X PUT \
  http://127.0.0.1:8000/superadmin/users/$FRANK_ID/blocks \
  -H "Authorization: Bearer $SA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocks": [{"slug": "logistica", "level": "view"}]}'

# Login como frank_sonco → obtener FRANK_TOKEN

# Intentar crear un material (operación de escritura en logística)
curl -X POST http://127.0.0.1:8000/logistics/materials \
  -H "Authorization: Bearer $FRANK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
# Debe retornar 403
```

---

## Compuerta de verificación

```bash
# Desde la raíz del repo
.\verify.ps1
```

**Debe pasar:**
- `python -c "import app.main"` ✅
- `pytest tests/smoke` ✅ (incluyendo nuevos smoke tests del bloque 008)
- `npm run build` ✅
