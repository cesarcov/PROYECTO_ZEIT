# Implementation Plan: Control de Acceso por Bloques (Superadmin)

**Branch**: `008-control-acceso-bloques` | **Date**: 2026-06-30
**Spec**: [spec.md](spec.md)

---

## Summary

Implementar control granular de acceso por bloques (Logística, Operaciones,
Administración, Gerencia) con niveles view/edit, gestionado por el superadmin (TI)
desde una UI dedicada. Fix prioritario: eliminar ghost buttons — si un usuario no
tiene un bloque asignado, ese elemento de navegación no existe en el DOM.

El sistema actual deriva módulos de forma heurística (nombres de roles en
`_compute_modules()`). Esta feature lo reemplaza con una tabla explícita
`user_block_permissions` y propaga los bloques en el JWT y localStorage.

---

## Technical Context

**Language/Version**: Python 3.11 (backend) · React 18 + Vite (frontend)

**Primary Dependencies**: FastAPI · psycopg2 · python-jose (JWT) · React Router v6
(sin dependencias nuevas — Constitución Art. 1)

**Storage**: PostgreSQL — nueva tabla `user_block_permissions` (ver data-model.md)

**Testing**: pytest (smoke tests) · verify.ps1

**Target Platform**: Linux server (Render) + browser

**Performance Goals**: La lista de bloques del usuario se incluye en el JWT para
evitar consultas adicionales por request. El endpoint `/auth/me` también la expone
para refresh sin re-login.

**Constraints**: Sin librerías nuevas. Backward compatible: `modules` en JWT se
mantiene. Usuarios sin filas en `user_block_permissions` ven el dashboard vacío
con mensaje (no rotura silenciosa).

**Scale/Scope**: ~13 usuarios actuales; crece con multi-tenant (feature 007).

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Artículo | Regla | Estado |
|----------|-------|--------|
| Art. 1 — Módulos | Nuevo código en `app/modules/superadmin/` (ya existe) y `app/core/blocks.py` | ✅ Conforme |
| Art. 1 — DB queries | Toda SQL en `service.py`, no en `router.py` | ✅ Conforme |
| Art. 1 — Sin deps nuevas | Solo psycopg2 + jose (ya en uso) | ✅ Conforme |
| Art. 2 — Frontend tokens | Colores de la UI de gestión usan `var(--primary)`, no hex | ✅ Pendiente verificar en impl. |
| Art. 4 — Superadmin total | `require_superadmin` ya implementado; nuevo código lo reutiliza | ✅ Conforme |
| Art. 4.4 — Ghost buttons | La corrección es el objetivo central de esta feature | ✅ Objetivo central |
| Art. 5 — Compuerta verde | `verify.ps1` debe pasar antes de merge; smoke tests nuevos requeridos | ✅ Pendiente |
| Art. 7 — SDD | Spec → Plan → Tasks → Implement | ✅ En proceso |

---

## Project Structure

### Documentation (this feature)

```text
specs/008-control-acceso-bloques/
├── spec.md              ✅ Listo
├── plan.md              ✅ Este archivo
├── research.md          ✅ Listo
├── data-model.md        ✅ Listo
├── quickstart.md        ✅ Listo
├── contracts/
│   └── api.md           ✅ Listo
└── tasks.md             Pendiente (/speckit-tasks)
```

### Source Code (archivos a crear/modificar)

```text
Backend (nuevo):
app/
├── core/
│   └── blocks.py                    NUEVO — constantes VALID_BLOCKS, BLOCK_TO_MODULES
└── modules/
    └── superadmin/
        ├── router.py                MODIFICAR — añadir 3 endpoints de bloques
        ├── service.py               MODIFICAR — lógica de get/set bloques
        └── schemas.py               MODIFICAR — BlockAssignment, UserBlocksOut, etc.

Backend (modificar):
app/
└── core/
    └── security/
        ├── auth.py                  MODIFICAR — get_user_blocks(), extend JWT, extend login
        └── router.py                MODIFICAR — incluir blocks en login/refresh/me response

migrations/
└── 040_user_block_permissions.sql   NUEVO

Frontend (nuevo):
frontend/myapp/src/
├── constants/
│   └── blocks.js                    NUEVO — BLOCKS array con slugs, labels, modules
└── pages/
    └── admin/
        └── SuperadminUserBlocks.jsx  NUEVO — UI gestión de bloques por usuario

Frontend (modificar):
frontend/myapp/src/
├── hooks/
│   └── useAuth.js                   MODIFICAR — exponer auth.blocks + auth.canEditBlock()
├── components/
│   └── Layout.jsx                   MODIFICAR — visibleModules usa auth.blocks (fix ghost buttons)
└── pages/
    ├── Login.jsx                    MODIFICAR — guardar blocks en localStorage
    └── admin/
        └── AdminUsers.jsx (o similar) MODIFICAR — mostrar chips de bloques en lista de usuarios
```

---

## Phase 0: Research

✅ Completado — ver [research.md](research.md)

Decisiones clave:
1. Nueva tabla `user_block_permissions` reemplaza heurístico de `_compute_modules`
2. `blocks` se añade al JWT payload y al localStorage (no rompe `modules` existente)
3. Los endpoints de gestión se añaden al módulo `superadmin` existente
4. El campo `blocks` en el JWT es la fuente de verdad para renderizado del sidebar
5. Superadmin recibe `blocks: "all"` en la respuesta de login; Layout lo detecta

---

## Phase 1: Design

✅ Completado — artefactos generados:

- [data-model.md](data-model.md) — tabla `user_block_permissions`, migración 040, cambios en JWT
- [contracts/api.md](contracts/api.md) — 3 endpoints nuevos + cambios en login/refresh/me
- [quickstart.md](quickstart.md) — 6 escenarios de validación end-to-end

---

## Decisiones de diseño clave

### D1. Ghost Button Fix (US1)

**Cambio en `Layout.jsx` (línea ~419):**

Antes:
```js
const userModules = auth.modules || [auth.role];
const visibleModules = MODULES.filter((m) =>
  userModules.some(r => m.roles.includes(r))
);
```

Después (importa BLOCK_TO_MODULES de `src/constants/blocks.js`):
```js
const visibleModules = auth.role === "superadmin"
  ? MODULES
  : MODULES.filter((m) =>
      (auth.blocks || []).some(b => BLOCK_TO_MODULES[b.slug]?.includes(m.key))
    );
```

Este es el cambio mínimo en Layout.jsx que resuelve completamente el ghost button.
Los `MODULES[]` de Layout.jsx no se modifican.

### D2. Nivel view vs edit

`useAuth.js` expone `canEditBlock(slug)`:
```js
canEditBlock: (slug) => {
  if (role === "superadmin") return true;
  const block = (blocks || []).find(b => b.slug === slug);
  return block?.level === "edit";
}
```

Los componentes con acciones de escritura consultan esto:
```jsx
{auth.canEditBlock("logistica") && <button>+ Nuevo</button>}
```

El slug de bloque a usar en cada componente se determina por el módulo que lo
contiene (ver `BLOCK_TO_MODULES` en contracts/api.md).

### D3. Propagación en login/refresh

El backend añade `blocks` al response de `/auth/login` y `/auth/refresh`.
Login.jsx los guarda en `localStorage.setItem("blocks", JSON.stringify(blocks))`.
`useAuth.js` los lee de localStorage (o del JWT si no están en localStorage).

### D4. Usuario sin bloques

Si `auth.blocks = []` y `role !== "superadmin"`, `visibleModules` es vacío array.
Layout.jsx detecta esto y en lugar de un sidebar vacío muestra un estado especial.
La página `/inicio` (HomeDashboard) muestra un mensaje claro.

### D5. Backward compatibility

- `modules` en JWT se mantiene inalterado (otros módulos del sistema lo usan)
- `auth.modules` sigue disponible en useAuth.js
- La migración a `auth.blocks` es gradual; coexisten

---

## Constitution Check Post-Design

| Regla | Verificación |
|-------|-------------|
| Sin SQL en router | ✅ `get_user_blocks()`, `set_user_blocks()` van en `service.py` |
| Backward compat | ✅ `modules` en JWT se mantiene |
| Tokens de color | ✅ UI de bloques debe usar `var(--primary)`, `var(--accent)` |
| Auditoría automática | ✅ PUT `/superadmin/users/{id}/blocks` auditado por `AuditMiddleware` |
| Art. 4.4 ghost buttons | ✅ Corrección central — Layout.jsx actualizado |
| Sin librerías nuevas | ✅ Solo psycopg2 + jose ya presentes |

---

## Complexity Tracking

No hay violaciones de la Constitución que justificar. El diseño sigue los patrones
existentes del proyecto (nuevo módulo en `superadmin/`, nueva tabla, extensión de JWT).
