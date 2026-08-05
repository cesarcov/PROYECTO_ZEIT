"""Configuración de marca (white-label). SQL aislado del router (Art. 1).

Fila singleton en `branding`. Campos NULL = usar default ZEIT. Las imágenes se
guardan en `app/storage/branding/` y se sirven vía `/branding-assets`.
"""
import os
import re

from psycopg2 import sql

from app.core.database import db_connection
from app.core.db import get_conn
from app.core.storage import obtener_almacen, validar_y_normalizar

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
    "color_primario", "color_acento", "color_accion", "color_texto_secundario",
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
    """URL pública del logo.

    Convive con dos formatos: las filas nuevas guardan la URL completa
    (Supabase o `/branding-assets/...`), las antiguas guardaban la ruta del
    disco (`app/storage/branding/claro.png`) y se traducen al vuelo.
    """
    if not path:
        return None
    if path.startswith(("http://", "https://", "/")):
        return path
    return f"{ASSET_BASE}/{os.path.basename(path)}"


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
            "textSecondary": b.get("color_texto_secundario"),
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
    for k in ("color_primario", "color_acento", "color_accion", "color_texto_secundario"):
        v = data.get(k)
        if v not in (None, "") and not HEX_RE.match(str(v)):
            raise ValueError(f"Color inválido en {k}: {v}")

    editable = ("nombre_producto", "eslogan", "logo_incluye_nombre",
                "color_primario", "color_acento", "color_accion", "color_texto_secundario")
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


# La validación de imágenes vive ahora en app/core/storage.py: es común a
# logos y avatares, detecta el tipo por firma binaria y re-encodea (RN-02).


def save_logo(variant: str, filename: str, content: bytes) -> str:
    """Valida, re-encodea y sube el logo; guarda en la BD sólo la URL resultante.

    F-000 / T-11 — el archivo va a Supabase Storage si está configurado (y
    entonces sobrevive a los redeploys) o al disco local si no. `filename` ya
    no decide nada: el tipo se detecta por la firma binaria del contenido
    (RN-02), porque la extensión la controla quien sube el archivo.
    """
    if variant not in VARIANTS:
        raise ValueError("Variante inválida")

    limpio, ext, content_type = validar_y_normalizar(content)

    almacen = obtener_almacen("branding")
    # Se borran las variantes previas con otra extensión para no dejar huérfanos.
    almacen.borrar_variantes(variant, (".png", ".jpg", ".jpeg", ".gif", ".svg"))
    url = almacen.subir(f"{variant}{ext}", limpio, content_type)

    col = VARIANTS[variant]
    with get_conn(commit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("UPDATE branding SET {} = %s, updated_at = NOW() WHERE id = 1").format(
                    sql.Identifier(col)
                ),
                (url,),
            )
    return url


def reset_branding() -> dict:
    """Limpia la config y borra los archivos → vuelve a ZEIT."""
    almacen = obtener_almacen("branding")
    for variante in VARIANTS:
        almacen.borrar_variantes(variante, (".png", ".jpg", ".jpeg", ".gif", ".svg"))
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """UPDATE branding SET
                    nombre_producto = NULL, eslogan = NULL, logo_incluye_nombre = TRUE,
                    color_primario = NULL, color_acento = NULL, color_accion = NULL,
                    color_texto_secundario = NULL,
                    logo_claro_path = NULL, logo_oscuro_path = NULL,
                    isotipo_path = NULL, favicon_path = NULL, updated_at = NOW()
                   WHERE id = 1"""
            )
        conn.commit()
    return get_branding_public()
