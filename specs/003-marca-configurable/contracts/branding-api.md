# API Contract: Marca configurable

**Phase 1** · Branch `003-marca-configurable` · 2026-06-20

Módulo nuevo `app/modules/branding/`. SQL en `service.py` (Art. 1). Imágenes servidas vía `StaticFiles` montado en `/branding-assets`.

## Endpoints

### `GET /branding` — público (sin auth)

- **Quién**: cualquiera (lo usa el login antes de autenticar).
- **Respuesta 200**: el objeto de marca (ver `data-model.md`). Campos no configurados → `null` (el frontend usa el default ZEIT).

### `PUT /branding` — admin

- **Auth**: `require_permission("admin:users")`.
- **Body** (JSON, todos opcionales): `nombre_producto`, `eslogan`, `color_primario`, `color_acento`, `color_accion`.
- **200**: objeto de marca actualizado. **422**: color inválido (conserva lo anterior). **401/403**: sin permiso.

### `POST /branding/logo` — admin (subida de imagen)

- **Auth**: `require_permission("admin:users")`.
- **Query**: `variant` ∈ `claro | oscuro | isotipo | favicon`.
- **Body**: `multipart/form-data` con el archivo.
- **Validación**: PNG/JPG (Pillow) o SVG (XML `<svg`); ≤ 2 MB.
- **200**: `{ "variant": "...", "path": "/branding-assets/..." }`. **422**: formato/tamaño inválido (conserva la anterior). **401/403**: sin permiso.

### `DELETE /branding` — admin (restablecer a ZEIT)

- **Auth**: `require_permission("admin:users")`.
- **Efecto**: limpia campos a `NULL` y borra los archivos subidos.
- **200**: objeto de marca por defecto (ZEIT).

## Contrato Frontend ↔ Backend

- El frontend llama `GET /branding` **una vez al arrancar** (y cachea); aplica nombre, eslogan, logos, favicon/título y **colores** (variables CSS sobre la raíz).
- Si `GET /branding` falla o devuelve todo `null`, se usan los **defaults ZEIT** de la feature 002 (sin romper nada).
- El crédito `poweredBy` se muestra siempre tal cual lo manda el backend (fijo).
- Tras guardar en el panel de admin, el cambio se ve en la próxima carga de cada usuario.
