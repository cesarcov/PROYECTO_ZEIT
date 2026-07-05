# Contrato API: Branding (modificado para feature 009)

**Módulo**: `/branding`
**Cambio**: El endpoint GET y PUT se amplían para incluir el 4to token `textSecondary`.

---

## GET /branding

**Auth**: Ninguna (público — Art. 8.2 de la constitución)

### Response (sin cambios en estructura, solo se agrega un campo en `colors`)

```json
{
  "appName": "ZEIT SOLUTIONS",
  "tagline": "Confiabilidad que impulsa la industria",
  "logoIncluyeNombre": true,
  "colors": {
    "primary":       "#003A8C",
    "accent":        "#00D4D8",
    "action":        "#FF6B00",
    "textSecondary": "#5A6573"   // ← NUEVO (null si no configurado)
  },
  "logos": {
    "claro":  null,
    "oscuro": null,
    "icono":  null,
    "favicon": null
  },
  "poweredBy": "Powered by CeShark · ERP Engine"
}
```

**Comportamiento de `null`**: Si el admin no ha configurado el color, el campo devuelve `null`
y el frontend usa el default ZEIT de `themes.css`. El frontend NO debe reemplazar el token CSS
con `null`.

---

## PUT /branding

**Auth**: Requerida (`admin:*` o permiso de branding)

### Request body (se agrega campo opcional)

```json
{
  "nombre_producto":        "Empresa XYZ ERP",
  "eslogan":                "Frase de la empresa",
  "logo_incluye_nombre":    true,
  "color_primario":         "#1A3A8C",
  "color_acento":           "#00B4B8",
  "color_accion":           "#E05A00",
  "color_texto_secundario": "#4A5566"    // ← NUEVO (opcional, hex válido o null)
}
```

**Validaciones**:
- Cada campo de color, si presente, DEBE ser `null` o un hex válido (`#RGB` o `#RRGGBB`).
- Si es inválido → HTTP 422 con mensaje `"Color inválido en {campo}: {valor}"`.
- La validación de contraste es responsabilidad del frontend; el backend solo valida formato.

### Response

Igual que `GET /branding` (el estado actualizado completo).

---

## GET /auth/me/preferences

**Auth**: Requerida

### Response (sin cambios en estructura)

```json
{
  "tema":                "zeit-claro",
  "notificaciones":      true,
  "compact_mode":        false
}
```

**Valores válidos para `tema` después de esta feature**:
- `"zeit-claro"` (única opción clara)
- `"zeit-oscuro"` (única opción oscura)

Cualquier otro valor almacenado se trata como `"zeit-claro"` en el frontend.

---

## PUT /auth/me/preferences

**Auth**: Requerida

### Request body

```json
{
  "tema": "zeit-oscuro"
}
```

**Validación**: El backend acepta cualquier string no vacío (no valida el catálogo de temas —
es responsabilidad del frontend enviar solo los valores válidos).
