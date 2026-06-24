# Research & Design Decisions: Marca configurable

**Phase 0** · Branch `003-marca-configurable` · 2026-06-20

Las 3 decisiones que el clarify dejó para el plan, más las de soporte.

### D1 — Almacenamiento de los logos: archivos en disco

- **Decisión**: Guardar las imágenes subidas en `app/storage/branding/` y servirlas como estáticos (`StaticFiles` montado en `/branding-assets`). En la tabla se guarda solo la **ruta/URL**.
- **Rationale**: Mantiene la base de datos liviana y las respuestas chicas; reaprovecha la convención `app/storage/` (ya existe e ignorada por git). Servir por URL permite cachear en el navegador.
- **Alternativas rechazadas**: Base64 en la BD (infla la BD y cada respuesta de marca); almacenamiento de objetos S3 (excesivo para una instalación on-prem).

### D2 — Aplicar los colores corporativos a todos los temas

- **Decisión**: Al cargar la marca, fijar variables CSS en la **raíz** (`document.documentElement.style.setProperty('--primary'|'--accent'|'--action', ...)`). Eso **sobrescribe** el valor que cada `[data-theme]` define para esos tokens, en los 5 temas, sin tocar fondos/superficies/bordes.
- **Rationale**: Una propiedad CSS inline en el elemento raíz gana en especificidad sobre las reglas `[data-theme="..."]` de la hoja de estilos, así un solo set de colores se aplica a cualquier tema. Como los fondos y el texto los sigue definiendo el tema, el **contraste se preserva**.
- **Alternativas rechazadas**: Reescribir `themes.css` por empresa (complejo, no dinámico); generar 5 temas completos desde 3 colores (mucha lógica de derivación y riesgo de contraste). Los tonos secundarios se **derivan** quedándose con los del tema activo.

### D3 — Lectura pública de la marca

- **Decisión**: `GET /branding` **sin autenticación**; las escrituras (`PUT/POST/DELETE`) requieren permiso admin.
- **Rationale**: La pantalla de **login** muestra la marca **antes** de autenticar, así que el endpoint de lectura debe ser público. Solo expone identidad visual (nombre, eslogan, colores, URLs de logo), no datos sensibles.
- **Alternativas rechazadas**: Empotrar la marca en el frontend (rompe la configurabilidad por servidor); exigir token para leer (rompería el login).

### D4 — Configuración singleton

- **Decisión**: Tabla `branding` de **una sola fila** (`id = 1`, con `CHECK (id = 1)`), todos los campos nullable (null = usar default ZEIT).
- **Rationale**: Hay una sola marca global por instalación. Simple y directo.
- **Alternativas rechazadas**: Tabla key-value de settings (más genérica pero más código y casteos); multi-tenant (fuera de alcance, declarado en la spec).

### D5 — Validación de imágenes (formato, tamaño, seguridad)

- **Decisión**: Aceptar **PNG/JPG** validados con Pillow (que abra como imagen real) y **SVG** validado por extensión/tipo + que el contenido sea XML/`<svg`. Tamaño máximo **2 MB**. Las imágenes se muestran siempre vía `<img src>`.
- **Rationale**: Pillow evita archivos corruptos o disfrazados. Servir SVG vía `<img>` evita ejecución de scripts embebidos (los navegadores no ejecutan JS de un SVG cargado como `<img>`), mitigando XSS.
- **Alternativas rechazadas**: Permitir cualquier archivo (riesgo); incrustar SVG inline (riesgo XSS); sanitizar SVG con librería extra (innecesario si se sirve como `<img>`).
