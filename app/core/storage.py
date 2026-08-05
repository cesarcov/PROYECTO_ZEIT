"""Almacenamiento de archivos subidos (logos y avatares).

F-000 / T-11 — OBJ-5: los archivos subidos deben sobrevivir a un redeploy.

El disco de Render en el plan gratuito es EFÍMERO: cada redeploy borra
`app/storage/`, así que los logos que el administrador subía se perdían. Aquí
se elige el backend según la configuración:

  · `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` → Supabase Storage (persistente).
  · sin ellas                                → disco local (desarrollo).

En ambos casos la aplicación guarda en la base de datos SÓLO la URL resultante.

RN-02 — todo archivo subido se valida y se re-encodea antes de almacenarse:

  1. Se comprueba el tamaño.
  2. Se detecta el tipo real por FIRMA BINARIA, no por la extensión del nombre
     (que la controla el atacante).
  3. Las imágenes de mapa de bits se abren con Pillow y se vuelven a escribir
     desde cero. Eso descarta metadatos y destruye cualquier payload incrustado
     (p. ej. PHP o JS escondido en un chunk EXIF).
  4. Los SVG se sanean: son XML ejecutable, así que se rechazan si contienen
     scripts, manejadores de eventos o referencias externas.
"""
import logging
import os
import re
from io import BytesIO

import requests

from app.core.config import settings

logger = logging.getLogger(__name__)

MAX_BYTES = 2 * 1024 * 1024  # 2 MB

# Firma binaria -> (extensión canónica, formato de Pillow)
_FIRMAS = [
    (b"\x89PNG\r\n\x1a\n", ".png", "PNG"),
    (b"\xff\xd8\xff", ".jpg", "JPEG"),
    (b"GIF87a", ".gif", "GIF"),
    (b"GIF89a", ".gif", "GIF"),
]

# Patrones que convierten un SVG en un vector de XSS.
_SVG_PELIGROSO = re.compile(
    rb"<\s*script|javascript:|\bon\w+\s*=|<\s*foreignObject|<!ENTITY|xlink:href\s*=\s*[\"']\s*(?!#)",
    re.IGNORECASE,
)


class ArchivoInvalido(ValueError):
    """El archivo subido no pasa la validación. El mensaje es seguro de mostrar."""


# ── Validación y re-encodeo (RN-02) ──────────────────────────────────────────


def _detectar_tipo(content: bytes) -> tuple[str, str | None]:
    """Devuelve (extensión, formato_pillow). Lanza si el tipo no está permitido."""
    for firma, ext, formato in _FIRMAS:
        if content.startswith(firma):
            return ext, formato

    cabecera = content[:2048].lstrip().lower()
    if cabecera.startswith(b"<?xml") or b"<svg" in cabecera:
        return ".svg", None

    raise ArchivoInvalido(
        "Formato no soportado. Usa PNG, JPG, GIF o SVG "
        "(se comprueba el contenido real del archivo, no su extensión)."
    )


def _sanear_svg(content: bytes) -> bytes:
    if _SVG_PELIGROSO.search(content):
        raise ArchivoInvalido(
            "El SVG contiene scripts o referencias externas y fue rechazado por seguridad."
        )
    return content


def _reencodear_imagen(content: bytes, formato: str) -> bytes:
    """Reescribe la imagen desde sus píxeles: destruye cualquier payload incrustado."""
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow no está instalado: no se puede re-encodear la imagen.")
        return content

    try:
        imagen = Image.open(BytesIO(content))
        imagen.load()  # fuerza la decodificación completa; detecta imágenes corruptas
    except Exception:
        raise ArchivoInvalido("La imagen no es válida o está corrupta.")

    # JPEG no admite canal alfa.
    if formato == "JPEG" and imagen.mode in ("RGBA", "P", "LA"):
        imagen = imagen.convert("RGB")

    # Pillow propaga al guardar lo que encuentre en `info` (comentario JPEG,
    # EXIF, perfil ICC, chunks tEXt del PNG...). Vaciarlo es lo que garantiza
    # que sólo salgan píxeles, sin metadatos heredados del archivo original.
    imagen.info = {}

    salida = BytesIO()
    # Sin `exif=`, `comment=` ni `icc_profile=`: se descartan a propósito.
    imagen.save(salida, format=formato, optimize=True)
    return salida.getvalue()


def validar_y_normalizar(content: bytes) -> tuple[bytes, str, str]:
    """Valida y re-encodea. Devuelve (bytes_limpios, extensión, content_type)."""
    if not content:
        raise ArchivoInvalido("El archivo está vacío.")
    if len(content) > MAX_BYTES:
        raise ArchivoInvalido(f"El archivo supera {MAX_BYTES // (1024 * 1024)} MB.")

    ext, formato = _detectar_tipo(content)

    if ext == ".svg":
        return _sanear_svg(content), ".svg", "image/svg+xml"

    limpio = _reencodear_imagen(content, formato)
    tipos = {".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif"}
    return limpio, ext, tipos[ext]


# ── Backends ─────────────────────────────────────────────────────────────────


class AlmacenLocal:
    """Disco local. EFÍMERO en Render: sólo para desarrollo."""

    persistente = False

    def __init__(self, carpeta: str, url_base: str):
        self.carpeta = carpeta
        self.url_base = url_base

    def subir(self, nombre: str, content: bytes, content_type: str) -> str:
        os.makedirs(self.carpeta, exist_ok=True)
        destino = os.path.join(self.carpeta, nombre)
        with open(destino, "wb") as f:
            f.write(content)
        return f"{self.url_base}/{nombre}"

    def borrar_variantes(self, base: str, extensiones: tuple[str, ...]) -> None:
        for ext in extensiones:
            ruta = os.path.join(self.carpeta, f"{base}{ext}")
            if os.path.exists(ruta):
                try:
                    os.remove(ruta)
                except OSError:
                    logger.debug("No se pudo borrar %s", ruta, exc_info=True)


class AlmacenSupabase:
    """Supabase Storage vía su API REST. Sobrevive a los redeploys (OBJ-5)."""

    persistente = True

    def __init__(self, bucket: str):
        self.bucket = bucket
        self.base = settings.SUPABASE_URL.rstrip("/")
        self.key = settings.SUPABASE_SERVICE_KEY

    @property
    def _cabeceras(self) -> dict:
        return {
            "Authorization": f"Bearer {self.key}",
            "apikey": self.key,
        }

    def subir(self, nombre: str, content: bytes, content_type: str) -> str:
        url = f"{self.base}/storage/v1/object/{self.bucket}/{nombre}"
        respuesta = requests.post(
            url,
            data=content,
            headers={
                **self._cabeceras,
                "Content-Type": content_type,
                # Sobrescribe si ya existe (el nombre es determinista).
                "x-upsert": "true",
            },
            timeout=30,
        )
        if respuesta.status_code >= 400:
            logger.error(
                "Supabase Storage rechazó la subida (%s): %s",
                respuesta.status_code, respuesta.text[:300],
            )
            raise ArchivoInvalido(
                "No se pudo guardar el archivo en el almacenamiento. Inténtalo de nuevo."
            )
        return f"{self.base}/storage/v1/object/public/{self.bucket}/{nombre}"

    def borrar_variantes(self, base: str, extensiones: tuple[str, ...]) -> None:
        objetos = [f"{base}{ext}" for ext in extensiones]
        try:
            requests.delete(
                f"{self.base}/storage/v1/object/{self.bucket}",
                json={"prefixes": objetos},
                headers={**self._cabeceras, "Content-Type": "application/json"},
                timeout=30,
            )
        except requests.RequestException:
            # Dejar un archivo huérfano no justifica romper la operación del usuario.
            logger.warning("No se pudieron borrar variantes previas en Supabase", exc_info=True)


# ── Selección del backend ────────────────────────────────────────────────────

_ALMACENES: dict[str, object] = {}


def _configurado() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY)


def obtener_almacen(clase: str):
    """Devuelve el almacén de 'branding' o 'avatars', creándolo la primera vez."""
    if clase in _ALMACENES:
        return _ALMACENES[clase]

    if clase == "branding":
        bucket = settings.SUPABASE_BUCKET_BRANDING
        carpeta = os.path.join("app", "storage", "branding")
        url_base = "/branding-assets"
    elif clase == "avatars":
        bucket = settings.SUPABASE_BUCKET_AVATARS
        carpeta = os.path.join("app", "storage", "avatars")
        url_base = "/avatar-assets"
    else:
        raise ValueError(f"Clase de almacén desconocida: {clase}")

    if _configurado():
        almacen = AlmacenSupabase(bucket)
        logger.info("Almacén '%s' -> Supabase Storage (bucket '%s')", clase, bucket)
    else:
        almacen = AlmacenLocal(carpeta, url_base)
        logger.warning(
            "Almacén '%s' -> disco local. EFÍMERO en Render: los archivos se "
            "pierden en cada redeploy. Configura SUPABASE_URL y SUPABASE_SERVICE_KEY.",
            clase,
        )

    _ALMACENES[clase] = almacen
    return almacen


def almacenamiento_es_persistente() -> bool:
    """Lo consulta /health para avisar si los archivos se van a perder."""
    return _configurado()
