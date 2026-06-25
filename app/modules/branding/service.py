"""Configuración de marca (white-label). SQL aislado del router (Art. 1).

Fila singleton en `branding`. Campos NULL = usar default ZEIT. Las imágenes se
guardan en `app/storage/branding/` y se sirven vía `/branding-assets`.
"""
import os
import re
from io import BytesIO

from psycopg2 import sql

from app.core.database import db_connection

STORAGE_DIR = os.path.join("app", "storage", "branding")
ASSET_BASE = "/branding-assets"
MAX_BYTES = 2 * 1024 * 1024  # 2 MB
HEX_RE = re.compile(r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$")

# variante -> columna de ruta
VARIANTS = {
    "claro": "logo_claro_path",
    "oscuro": "logo_oscuro_path",
    "isotipo": "isotipo_path",
    "favicon": "favicon_path",
}

_COLS = [
    "nombre_producto", "eslogan", "logo_incluye_nombre",
    "color_primario", "color_acento", "color_accion",
    "logo_claro_path", "logo_oscuro_path", "isotipo_path", "favicon_path",
]

# Defaults de marca ZEIT (cuando la fila está vacía)
DEFAULT_APP_NAME = "ZEIT SOLUTIONS"
DEFAULT_TAGLINE = "Confiabilidad que impulsa la industria"
POWERED_BY = "Powered by CeShark · ERP Engine"


def _raw():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("SELECT {} FROM branding WHERE id = 1").format(
                    sql.SQL(", ").join(sql.Identifier(c) for c in _COLS)
                )
            )
            row = cur.fetchone()
    return dict(zip(_COLS, row)) if row else {}


def _url(path):
    return f"{ASSET_BASE}/{os.path.basename(path)}" if path else None


def get_branding_public() -> dict:
    """Forma pública consumida por el frontend (con defaults ZEIT)."""
    b = _raw()
    incluye = b.get("logo_incluye_nombre")
    return {
        "appName": b.get("nombre_producto") or DEFAULT_APP_NAME,
        "tagline": b.get("eslogan") or DEFAULT_TAGLINE,
        "logoIncluyeNombre": True if incluye is None else bool(incluye),
        "colors": {
            "primary": b.get("color_primario"),
            "accent": b.get("color_acento"),
            "action": b.get("color_accion"),
        },
        "logos": {
            "claro": _url(b.get("logo_claro_path")),
            "oscuro": _url(b.get("logo_oscuro_path")),
            "icono": _url(b.get("isotipo_path")),
            "favicon": _url(b.get("favicon_path")),
        },
        "poweredBy": POWERED_BY,
    }


def update_branding(data: dict) -> dict:
    """Actualiza nombre/eslogan/colores/flag. Valida colores."""
    for k in ("color_primario", "color_acento", "color_accion"):
        v = data.get(k)
        if v not in (None, "") and not HEX_RE.match(str(v)):
            raise ValueError(f"Color inválido en {k}: {v}")

    editable = ("nombre_producto", "eslogan", "logo_incluye_nombre",
                "color_primario", "color_acento", "color_accion")
    fields = {k: v for k, v in data.items() if k in editable}
    if fields:
        sets = sql.SQL(", ").join(
            sql.SQL("{} = %s").format(sql.Identifier(k)) for k in fields
        )
        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    sql.SQL("UPDATE branding SET {}, updated_at = NOW() WHERE id = 1").format(sets),
                    list(fields.values()),
                )
            conn.commit()
    return get_branding_public()


def _validate_image(content: bytes, ext: str):
    if len(content) > MAX_BYTES:
        raise ValueError("El archivo supera 2 MB")
    if ext == ".svg":
        head = content[:2048].lower()
        if b"<svg" not in head and not content[:64].lstrip().lower().startswith(b"<?xml"):
            raise ValueError("SVG inválido")
        return
    if ext in (".png", ".jpg", ".jpeg"):
        try:
            from PIL import Image
            Image.open(BytesIO(content)).verify()
        except Exception:
            raise ValueError("La imagen no es válida")
        return
    raise ValueError("Formato no soportado (usar PNG, JPG o SVG)")


def save_logo(variant: str, filename: str, content: bytes) -> str:
    if variant not in VARIANTS:
        raise ValueError("Variante inválida")
    ext = os.path.splitext(filename or "")[1].lower()
    _validate_image(content, ext)
    os.makedirs(STORAGE_DIR, exist_ok=True)
    dest = os.path.join(STORAGE_DIR, f"{variant}{ext}")
    # limpiar variantes previas de la misma con otra extensión
    for e in (".png", ".jpg", ".jpeg", ".svg"):
        prev = os.path.join(STORAGE_DIR, f"{variant}{e}")
        if prev != dest and os.path.exists(prev):
            try:
                os.remove(prev)
            except OSError:
                pass
    with open(dest, "wb") as f:
        f.write(content)
    col = VARIANTS[variant]
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(f"UPDATE branding SET {col} = %s, updated_at = NOW() WHERE id = 1", (dest,))
        conn.commit()
    return _url(dest)


def reset_branding() -> dict:
    """Limpia la config y borra los archivos → vuelve a ZEIT."""
    raw = _raw()
    for col in ("logo_claro_path", "logo_oscuro_path", "isotipo_path", "favicon_path"):
        p = raw.get(col)
        if p and os.path.exists(p):
            try:
                os.remove(p)
            except OSError:
                pass
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE branding SET
                    nombre_producto = NULL, eslogan = NULL, logo_incluye_nombre = TRUE,
                    color_primario = NULL, color_acento = NULL, color_accion = NULL,
                    logo_claro_path = NULL, logo_oscuro_path = NULL,
                    isotipo_path = NULL, favicon_path = NULL, updated_at = NOW()
                   WHERE id = 1"""
            )
        conn.commit()
    return get_branding_public()
