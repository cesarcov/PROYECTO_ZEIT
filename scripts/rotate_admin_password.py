"""Rota la contraseña del usuario admin a una contraseña aleatoria fuerte.

F-000 / T-01 — RN-01: el admin inicial se crea con contraseña generada
aleatoriamente y entregada fuera de banda. `admin/admin123` deja de existir.

La contraseña se imprime UNA SOLA VEZ en stdout. No se guarda en ningún
archivo, ni en la base de datos en claro, ni en el historial de git.

Uso:
    python scripts/rotate_admin_password.py              # usuario "admin"
    python scripts/rotate_admin_password.py otro_usuario

Para el superadmin (cuyas credenciales viven en variables de entorno, no en la
base de datos) usa `scripts/generate_superadmin_hash.py`.
"""
import os
import secrets
import string
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import db_connection
from app.core.security.hashing import hash_password

# Sin caracteres ambiguos (O/0, l/1/I) para que se pueda dictar por teléfono.
ALPHABET = (
    "".join(c for c in string.ascii_letters if c not in "lIO")
    + "".join(c for c in string.digits if c not in "01")
    + "!@#$%*_-+="
)


def generate_password(length: int = 24) -> str:
    """Contraseña aleatoria criptográficamente segura con al menos un dígito y un símbolo."""
    while True:
        pwd = "".join(secrets.choice(ALPHABET) for _ in range(length))
        if (
            any(c.isdigit() for c in pwd)
            and any(c.isupper() for c in pwd)
            and any(c.islower() for c in pwd)
            and any(c in "!@#$%*_-+=" for c in pwd)
        ):
            return pwd


def rotate(username: str = "admin") -> int:
    new_password = generate_password()
    hashed = hash_password(new_password)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE username = %s", (username,))
            row = cur.fetchone()
            if not row:
                print(f"ERROR: el usuario '{username}' no existe en esta base de datos.")
                return 1
            cur.execute(
                "UPDATE users SET hashed_password = %s WHERE id = %s",
                (hashed, row[0]),
            )
            # Invalidar todas las sesiones abiertas: la contraseña vieja ya no vale.
            cur.execute(
                """
                UPDATE refresh_tokens
                SET revoked = TRUE, revoked_at = NOW()
                WHERE user_id = %s AND revoked = FALSE
                """,
                (row[0],),
            )
        conn.commit()

    print()
    print("=" * 64)
    print(f"  Contraseña rotada para el usuario: {username}")
    print(f"  NUEVA CONTRASEÑA: {new_password}")
    print("=" * 64)
    print("  Guárdala AHORA en tu gestor de contraseñas. No se vuelve a mostrar.")
    print("  Todas las sesiones activas de este usuario fueron revocadas.")
    print()
    return 0


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "admin"
    raise SystemExit(rotate(target))
