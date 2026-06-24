# Quickstart — Validación: Marca configurable (white-label)

**Phase 1** · Branch `003-marca-configurable` · 2026-06-20

## Prerrequisitos

- Migración `035_branding.sql` aplicada (`python run_migrations.py`).
- Backend (`uvicorn ...`) + frontend (`npm run dev`) levantados.
- Sesión como **admin** (ej. `admin` / `admin123`) y un usuario **no-admin** para la prueba de permisos.
- Dos imágenes de prueba (logo claro y oscuro) y una imagen inválida (o > 2 MB).

## Escenarios de aceptación

### E1 — Cambiar nombre y eslogan (US1, FR-002)
1. Admin → panel → **Marca**. Cambiar nombre a "ACME ERP" y el eslogan; guardar.
2. **Esperado**: login, barra lateral, menús y título de pestaña muestran "ACME ERP".

### E2 — Subir logo claro y oscuro (US2, FR-003/FR-010)
1. Subir logo para fondo claro y para fondo oscuro; guardar.
2. **Esperado**: el login (panel oscuro) muestra el logo oscuro; una superficie clara muestra el claro.

### E3 — Colores corporativos (US5, FR-011/FR-012)
1. Cambiar color **primario** y **acento** a los de otra empresa; guardar.
2. **Esperado**: botones, enlaces y navegación activa adoptan esos colores en cualquier tema; el texto sigue legible.

### E4 — Restablecer a ZEIT (US3, FR-004/FR-007)
1. Pulsar "Restablecer marca".
2. **Esperado**: vuelve el logo, nombre, eslogan y colores ZEIT; ninguna pantalla queda vacía.

### E5 — Solo admin (US4, FR-001, SC-003)
1. Iniciar sesión como usuario no-admin.
2. **Esperado**: no hay acceso a editar la marca; un `PUT /branding` directo responde 401/403.

### E6 — Validación de imagen (FR-008)
1. Subir un archivo no-imagen o > 2 MB.
2. **Esperado**: rechazo con mensaje claro; se conserva el logo anterior.

### E7 — Crédito fijo (FR-009)
1. Revisar login y footer.
2. **Esperado**: "Powered by CeShark · ERP Engine" siempre visible; no hay opción para ocultarlo.

## Validación rápida por API

```bash
curl -s http://127.0.0.1:8000/branding            # 200 público, objeto de marca
curl -s -o /dev/null -w "%{http_code}\n" -X PUT \
  http://127.0.0.1:8000/branding -H "Content-Type: application/json" \
  -d '{"nombre_producto":"ACME"}'                 # sin token → 401/403
```

## Compuerta (obligatoria antes de cerrar)

```powershell
.\verify.ps1   # import backend + pytest tests/smoke + npm run build → "TODO VERDE"
```
