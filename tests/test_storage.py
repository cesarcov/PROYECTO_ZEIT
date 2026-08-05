"""F-000 / T-11 — validación y re-encodeo de archivos subidos (RN-02).

No necesita base de datos ni red: prueba la capa de validación pura.
"""
from io import BytesIO

import pytest

from app.core.storage import MAX_BYTES, ArchivoInvalido, validar_y_normalizar


def _png(ancho=4, alto=4, con_exif=False) -> bytes:
    from PIL import Image

    imagen = Image.new("RGBA", (ancho, alto), (255, 0, 0, 255))
    salida = BytesIO()
    imagen.save(salida, format="PNG")
    return salida.getvalue()


def _jpg(ancho=4, alto=4) -> bytes:
    from PIL import Image

    imagen = Image.new("RGB", (ancho, alto), (0, 128, 255))
    salida = BytesIO()
    imagen.save(salida, format="JPEG")
    return salida.getvalue()


# ── Tipos aceptados ──────────────────────────────────────────────────────────


def test_acepta_png_y_devuelve_extension_canonica():
    limpio, ext, content_type = validar_y_normalizar(_png())
    assert ext == ".png"
    assert content_type == "image/png"
    assert limpio.startswith(b"\x89PNG\r\n\x1a\n")


def test_acepta_jpg():
    limpio, ext, content_type = validar_y_normalizar(_jpg())
    assert ext == ".jpg"
    assert content_type == "image/jpeg"
    assert limpio.startswith(b"\xff\xd8\xff")


def test_acepta_svg_limpio():
    svg = b'<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>'
    limpio, ext, content_type = validar_y_normalizar(svg)
    assert ext == ".svg"
    assert content_type == "image/svg+xml"


# ── El tipo se decide por el CONTENIDO, no por el nombre ─────────────────────


def test_rechaza_ejecutable_disfrazado_de_imagen():
    """Un .exe renombrado a .png no engaña a la detección por firma binaria."""
    with pytest.raises(ArchivoInvalido):
        validar_y_normalizar(b"MZ\x90\x00\x03" + b"\x00" * 200)


def test_rechaza_texto_plano():
    with pytest.raises(ArchivoInvalido):
        validar_y_normalizar(b"esto no es una imagen, es texto")


def test_rechaza_archivo_vacio():
    with pytest.raises(ArchivoInvalido):
        validar_y_normalizar(b"")


def test_rechaza_archivo_demasiado_grande():
    gigante = b"\x89PNG\r\n\x1a\n" + b"\x00" * (MAX_BYTES + 1)
    with pytest.raises(ArchivoInvalido, match="supera"):
        validar_y_normalizar(gigante)


def test_rechaza_png_corrupto():
    """Firma correcta pero contenido inservible: Pillow lo detecta al decodificar."""
    with pytest.raises(ArchivoInvalido):
        validar_y_normalizar(b"\x89PNG\r\n\x1a\n" + b"basura" * 20)


# ── SVG: es XML ejecutable ───────────────────────────────────────────────────


@pytest.mark.parametrize(
    "carga",
    [
        b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"></svg>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><a xlink:href="javascript:alert(1)">x</a></svg>',
        b'<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg/>',
        b'<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><iframe/></foreignObject></svg>',
    ],
)
def test_rechaza_svg_con_carga_activa(carga):
    with pytest.raises(ArchivoInvalido, match="seguridad"):
        validar_y_normalizar(carga)


# ── Re-encodeo (RN-02) ───────────────────────────────────────────────────────


def test_el_reencodeo_destruye_datos_incrustados():
    """Un payload escondido tras el IEND del PNG no debe sobrevivir."""
    original = _png()
    payload = b"<?php system($_GET['c']); ?>"
    contaminado = original + payload

    limpio, _, _ = validar_y_normalizar(contaminado)

    assert payload not in limpio, "el payload incrustado sobrevivió al re-encodeo"


def test_el_reencodeo_descarta_los_metadatos_exif():
    from PIL import Image

    imagen = Image.new("RGB", (8, 8), (10, 20, 30))
    salida = BytesIO()
    # Un comentario JPEG con un "secreto" que no debe llegar al almacenamiento.
    imagen.save(salida, format="JPEG", comment=b"SECRETO-EN-METADATOS")
    con_metadatos = salida.getvalue()
    assert b"SECRETO-EN-METADATOS" in con_metadatos

    limpio, _, _ = validar_y_normalizar(con_metadatos)
    assert b"SECRETO-EN-METADATOS" not in limpio


def test_la_imagen_reencodeada_sigue_siendo_valida():
    from PIL import Image

    limpio, _, _ = validar_y_normalizar(_png(ancho=12, alto=7))
    reabierta = Image.open(BytesIO(limpio))
    assert reabierta.size == (12, 7), "el re-encodeo no debe alterar las dimensiones"
