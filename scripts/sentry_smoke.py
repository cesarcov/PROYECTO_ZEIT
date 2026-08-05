"""Envía una excepción de prueba a Sentry para validar la integración.

F-000 / T-04 — validación: "una excepción de prueba aparece en el panel de Sentry".

Requiere `SENTRY_DSN` configurado en el entorno. Si no lo está, el script lo
dice y no hace nada (no es un error).

Uso:
    python scripts/sentry_smoke.py
"""
import os
import sys
import uuid

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.config import settings
from app.core.observability import capture_exception, init_sentry, tag_request


class PruebaDeSentry(RuntimeError):
    """Excepción sintética: si la ves en el panel, la integración funciona."""


def main() -> int:
    if not settings.SENTRY_DSN:
        print("SENTRY_DSN no está configurado — nada que probar.")
        print("Configúralo en .env (local) o en las variables del servicio (Render).")
        return 1

    if not init_sentry():
        print("Sentry no pudo inicializarse. Revisa el DSN.")
        return 1

    marca = uuid.uuid4().hex[:12]
    tag_request(marca)

    try:
        raise PruebaDeSentry(f"Prueba de integración F-000/T-04 — marca {marca}")
    except PruebaDeSentry as exc:
        capture_exception(exc)

    import sentry_sdk

    sentry_sdk.flush(timeout=10)

    print()
    print("Excepción de prueba enviada a Sentry.")
    print(f"  entorno   : {settings.ENV}")
    print(f"  release   : {settings.GIT_COMMIT}")
    print(f"  request_id: {marca}")
    print()
    print("Búscala en el panel filtrando por el tag  request_id:" + marca)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
