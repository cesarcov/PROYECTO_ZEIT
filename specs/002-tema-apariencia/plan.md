# Implementation Plan: Sistema de temas (apariencia) — motor + armazón (tramo 002a)

**Branch**: `002-tema-apariencia` | **Date**: 2026-06-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-tema-apariencia/spec.md`

## Summary

Construir el **motor de temas** del ERP: 5 temas nombrados definidos por **tokens de color (variables CSS)**, un **proveedor de tema** en React que aplica el tema activo a toda la app al instante, soporte de **"seguir el sistema operativo"**, y **persistencia en la cuenta del usuario** (nueva columna `preferencias` JSONB + endpoints `GET/PUT /auth/me/preferences`), con caché en `localStorage` para evitar parpadeo en el primer render. En este tramo se migra a tokens el **armazón** (barra lateral, encabezado, footer, login) y la página de **Preferencias**, y se aplica la marca **ZEIT Solutions** (logo + "Powered by CeShark · ERP Engine"). La migración del resto de vistas (~70) queda para tramos siguientes.

## Technical Context

**Language/Version**: Python 3.11 (backend) · JavaScript ES2020 + React 18 (frontend)

**Primary Dependencies**: FastAPI, psycopg2 · React + Vite + **Tailwind CSS v4** (soporta variables CSS / `@theme`). Sin librerías nuevas: el theming se hace con variables CSS nativas + Context API.

**Storage**: PostgreSQL — nueva columna `users.preferencias` (JSONB, default `{}`). El tema vive en esa preferencia (`{"tema": "zeit-claro" | ... | "system"}`).

**Testing**: pytest (`tests/smoke`) + `npm run build`, vía `verify.ps1`.

**Target Platform**: Servidor web + SPA navegador.

**Project Type**: Aplicación web (backend + frontend).

**Performance Goals**: cambio de tema < 1 s (instantáneo, sin recargar); primer render sin parpadeo de tema (token leído de `localStorage` antes de pintar).

**Constraints**: cero parpadeo (FOUC de tema); cero regresión funcional; el armazón y Preferencias quedan 100% por tokens; el resto de vistas siguen usables (no rotas) aunque aún no migradas.

**Scale/Scope (tramo 002a)**: 5 temas (tokens) · 1 proveedor de tema · 1 migración · 1 endpoint (get/put preferencias) · armazón (Layout, Login, footer) + Preferencias + logo ZEIT.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Artículo | Cumplimiento |
|---|---|
| **1. SQL solo en service.py** | ✅ El endpoint de preferencias hace SQL en `service.py`; el router solo declara la ruta. |
| **2. Theming por tokens + marca ZEIT** | ✅ Esta feature **implementa** el sistema de tokens exigido por la constitución v1.1.0; el armazón migra a tokens y aplica la marca ZEIT + "Powered by CeShark". |
| **3. Migraciones** | ✅ Nueva columna `users.preferencias` vía `migrations/034_user_preferencias.sql` + `run_migrations.py`. |
| **4. Permisos** | ✅ `GET/PUT /auth/me/preferences` operan sobre el **dato propio** del usuario autenticado (solo `get_current_user`), siguiendo el patrón ya existente de los endpoints `/my`; no requiere scope `require_permission`. |
| **5. Compuerta + smoke test** | ✅ Smoke test del endpoint de preferencias (200 + persistencia del tema); build cubre el frontend. |
| **6. Nulos defensivos** | ✅ `preferencias` puede ser `NULL`/`{}`; se lee con guarda y default de tema. |
| **FR-010 (naranja nunca principal)** | ✅ Regla codificada en los token sets: el naranja solo aparece en tokens de acción/acento, nunca en `--bg`/`--primary`. |

**Resultado**: Sin violaciones. No requiere Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/002-tema-apariencia/
├── plan.md              # Este archivo
├── research.md          # Decisiones de diseño (Phase 0)
├── data-model.md        # Modelo de datos + los 5 token sets (Phase 1)
├── quickstart.md        # Guía de validación (Phase 1)
├── contracts/
│   ├── preferences-api.md   # Contrato endpoints GET/PUT preferencias
│   └── theme-tokens.md      # Contrato de nombres de tokens (variables CSS)
└── tasks.md             # (lo genera /speckit-tasks)
```

### Source Code (repository root) — archivos que se tocan (tramo 002a)

```text
migrations/
└── 034_user_preferencias.sql          # + columna users.preferencias JSONB

app/modules/auth/  (router de auth existente)
├── router.py     # + GET/PUT /auth/me/preferences (solo declara ruta)
└── service.py    # + leer/guardar preferencias del usuario (SQL)

frontend/myapp/src/
├── theme/
│   ├── themes.css        # NUEVO: variables CSS por tema ([data-theme="..."]) — los 5 token sets
│   └── ThemeProvider.jsx # NUEVO: contexto useTheme (tema activo, "system", aplica data-theme, persiste)
├── main.jsx              # envolver App con ThemeProvider + script anti-parpadeo (lee localStorage)
├── components/
│   ├── Layout.jsx        # migrar colores del armazón a tokens; footer "Powered by CeShark"
│   └── ZeitLogo.jsx      # NUEVO (reemplaza CeSharkLogo): logo ZEIT (globo+onda)
├── pages/
│   ├── Login.jsx         # migrar a tokens + marca ZEIT + crédito CeShark
│   └── Preferences.jsx   # + sección "Apariencia": selector de 5 temas + "Seguir el sistema"; guardar en cuenta
└── services/api.js       # (si hace falta) helper para get/put preferencias

tests/smoke/
└── test_endpoints.py     # + test GET/PUT /auth/me/preferences (200 + persiste el tema)
```

**Structure Decision**: Aplicación web existente. Se agrega una capa de theming (carpeta `theme/`) y un endpoint de preferencias; se migra el armazón. Los módulos de negocio (~70 vistas) NO se tocan en este tramo (siguen usables); su migración a tokens se hará en features siguientes.

## Complexity Tracking

> No aplica — Constitution Check sin violaciones.
