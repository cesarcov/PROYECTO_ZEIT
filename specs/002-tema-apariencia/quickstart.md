# Quickstart — Validación: Sistema de temas (tramo 002a)

**Phase 1** · Branch `002-tema-apariencia` · 2026-06-20

Guía para comprobar que el motor de temas y el armazón funcionan de punta a punta. (Detalles de implementación van en `tasks.md`.)

## Prerrequisitos

- Migración aplicada: `venv\Scripts\python run_migrations.py` (crea `users.preferencias`).
- Backend: `venv\Scripts\uvicorn app.main:app --reload --host 127.0.0.1 --port 8000`
- Frontend: `npm --prefix frontend/myapp run dev`
- Sesión iniciada (ej. `juliet_alvis`).

## Escenarios de aceptación

### E1 — Cambiar de tema al instante (US1, FR-002)
1. Ir a **Preferencias → Apariencia**.
2. Elegir **ZEIT Oscuro**. **Esperado**: el armazón (sidebar, header, footer) cambia al instante, sin recargar.
3. Probar cada uno de los 5 temas. **Esperado**: cada uno aplica su paleta; en ninguno el fondo/sidebar es naranja (FR-010).

### E2 — Recordar el tema en la cuenta (US2, FR-003)
1. Elegir **ZEIT Turquesa**, cerrar sesión, volver a entrar. **Esperado**: abre en ZEIT Turquesa.
2. (Opcional) Entrar desde otro navegador con el mismo usuario. **Esperado**: mismo tema (viene de la cuenta).

### E3 — Seguir el sistema (FR-007)
1. Elegir **"Seguir el sistema"**.
2. Cambiar el modo claro/oscuro del sistema operativo. **Esperado**: la app sigue el cambio.
3. Usuario nuevo sin preferencia → arranca en "seguir el sistema".

### E4 — Sin parpadeo (anti-FOUC)
1. Con un tema oscuro elegido, recargar la página (F5). **Esperado**: NO se ve un destello claro antes de pintar el oscuro.

### E5 — Marca ZEIT (US3, FR-005)
1. Cerrar sesión → pantalla de **Login**. **Esperado**: logo + nombre **ZEIT Solutions** como marca principal y **"Powered by CeShark · ERP Engine"** en segundo plano.
2. Dentro, mirar el footer de la barra lateral. **Esperado**: crédito CeShark discreto.

### E6 — Sin regresión / vistas no migradas
1. Navegar a un módulo aún no migrado (ej. Logística). **Esperado**: sigue usable y legible (no roto), aunque todavía no tome todos los tokens.

## Validación por API (preferencias)

```bash
curl -s -X PUT "http://127.0.0.1:8000/auth/me/preferences" \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"tema":"zeit-oscuro"}'                       # espera 200 + {"tema":"zeit-oscuro",...}

curl -s "http://127.0.0.1:8000/auth/me/preferences" \
  -H "Authorization: Bearer <TOKEN>"                # espera 200 + tema persistido
```

## Compuerta (obligatoria antes de cerrar)

```powershell
.\verify.ps1   # import backend + pytest tests/smoke + npm run build → "TODO VERDE"
```
