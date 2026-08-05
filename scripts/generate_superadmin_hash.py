"""Genera credenciales de superadmin para pegar en el gestor de secretos del entorno.

F-000 / T-01 — el superadmin no vive en ninguna base de datos de tenant: su
usuario y el HASH de su contraseña se leen de variables de entorno
(`SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD_HASH`).

Este script imprime el par listo para copiar a Render / GitHub Actions secrets.
La contraseña en claro se muestra una sola vez y NO se persiste en ningún sitio.

Uso:
    python scripts/generate_superadmin_hash.py [username]
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.security.hashing import hash_password
from scripts.rotate_admin_password import generate_password


def main() -> int:
    username = sys.argv[1] if len(sys.argv) > 1 else "superadmin"
    password = generate_password(28)
    hashed = hash_password(password)

    print()
    print("=" * 72)
    print("  CREDENCIALES DE SUPERADMIN — cópialas ahora, no se vuelven a mostrar")
    print("=" * 72)
    print(f"  Usuario:     {username}")
    print(f"  Contraseña:  {password}")
    print()
    print("  Variables a cargar en el gestor de secretos del entorno:")
    print(f"    SUPERADMIN_USERNAME={username}")
    print(f"    SUPERADMIN_PASSWORD_HASH={hashed}")
    print("=" * 72)
    print("  NO pegues estos valores en ningún archivo del repositorio.")
    print()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
