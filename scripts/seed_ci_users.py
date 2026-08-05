"""Siembra los usuarios que la suite de tests necesita, para el CI.

F-000 / T-06 — el pipeline levanta un PostgreSQL efímero, aplica las migraciones
desde cero y luego llama a este script. Sin usuarios, todos los tests que
requieren sesión se omitirían y la cobertura no llegaría al umbral.

Las contraseñas se leen del entorno (`TEST_PASSWORD`, `TEST_ADMIN_PASSWORD`) y
sólo existen dentro del contenedor del job. NO hay contraseñas escritas aquí.

Uso:
    TEST_USER=... TEST_PASSWORD=... python scripts/seed_ci_users.py
"""
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import db_connection
from app.core.security.hashing import hash_password

# El rol debe existir tras aplicar las migraciones (001 y 005 los siembran).
USUARIOS = [
    ("TEST_USER", "TEST_PASSWORD", "Administrador General"),
    ("TEST_ADMIN_USER", "TEST_ADMIN_PASSWORD", "Administrador Maestro"),
]


def _upsert(cur, username: str, password: str, rol: str) -> None:
    hashed = hash_password(password)
    email = f"{username}@ci.local"

    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    if row:
        user_id = row[0]
        cur.execute(
            "UPDATE users SET email = %s, hashed_password = %s, is_active = TRUE WHERE id = %s",
            (email, hashed, user_id),
        )
    else:
        cur.execute(
            "INSERT INTO users (username, email, hashed_password, is_active) "
            "VALUES (%s, %s, %s, TRUE) RETURNING id",
            (username, email, hashed),
        )
        user_id = cur.fetchone()[0]

    cur.execute("SELECT id FROM roles WHERE name = %s", (rol,))
    rol_row = cur.fetchone()
    if not rol_row:
        raise SystemExit(
            f"ERROR: el rol '{rol}' no existe tras aplicar las migraciones. "
            "Revisa migrations/001 y migrations/005."
        )

    cur.execute("DELETE FROM user_roles WHERE user_id = %s", (user_id,))
    cur.execute(
        "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (user_id, rol_row[0]),
    )
    print(f"  OK  {username} -> {rol}")


def main() -> int:
    pendientes = []
    with db_connection() as conn:
        with conn.cursor() as cur:
            for var_usuario, var_clave, rol in USUARIOS:
                username = os.getenv(var_usuario, "").strip()
                password = os.getenv(var_clave, "").strip()
                if not username or not password:
                    pendientes.append(f"{var_usuario}/{var_clave}")
                    continue
                _upsert(cur, username, password, rol)
        conn.commit()

    if pendientes:
        print(f"  AVISO: sin sembrar por falta de variables: {', '.join(pendientes)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
