"""Siembra los usuarios base del ERP.

F-000 / T-01 — RN-01: NINGUNA contraseña está escrita en este archivo. Cada
usuario recibe una contraseña aleatoria fuerte que se imprime UNA SOLA VEZ al
final de la ejecución, para entregarse fuera de banda.

Uso:
    python scripts/seed_users.py
"""
import os
import sys
# Make sure we can import from app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.core.database import db_connection
from app.core.security.hashing import hash_password
from scripts.rotate_admin_password import generate_password

USERS_TO_SEED = [
    {
        "username": "admin",
        "email": "admin@ceshark.com",
        "roles": ["Administrador Maestro"]
    },
    {
        "username": "frank_sonco",
        "email": "frank_sonco@ceshark.com",
        "roles": ["Gerente General"]
    },
    {
        "username": "juliet_alvis",
        "email": "administracion@ceshark.com",
        "roles": ["Administrador General"]
    },
    {
        "username": "yasmyn_machuca",
        "email": "yasmyn_machuca@ceshark.com",
        "roles": ["Asistente Administrativo"]
    },
    {
        "username": "wilfredo_flores",
        "email": "wilfredo_flores@ceshark.com",
        "roles": ["Supervisor de Operaciones"]
    },
    {
        "username": "cesar_huamani",
        "email": "cesar_huamani@ceshark.com",
        "roles": ["Ingeniero de Campo", "Coordinador Logístico"]
    },
    {
        "username": "tiburoncito_junior",
        "email": "tiburoncito_junior@ceshark.com",
        "roles": ["Operador Logístico"]
    },
    {
        "username": "lagartija_segura",
        "email": "lagartija_segura@ceshark.com",
        "roles": ["Ingeniero de Campo"]
    },
    {
        "username": "felipe_choque",
        "email": "felipe_choque@ceshark.com",
        "roles": ["Ingeniero de Campo"]
    }
]

def seed():
    print("Iniciando la siembra de usuarios en la base de datos...")
    generadas: list[tuple[str, str]] = []
    with db_connection() as conn:
        with conn.cursor() as cur:
            for u in USERS_TO_SEED:
                username = u["username"]
                email = u["email"]
                password = generate_password()
                hashed = hash_password(password)
                generadas.append((username, password))

                # Check if user already exists
                cur.execute("SELECT id FROM users WHERE username = %s;", (username,))
                row = cur.fetchone()
                if row:
                    user_id = row[0]
                    print(f"Usuario '{username}' ya existe. Actualizando contraseña y email...")
                    cur.execute(
                        "UPDATE users SET email = %s, hashed_password = %s, is_active = TRUE WHERE id = %s;",
                        (email, hashed, user_id)
                    )
                else:
                    print(f"Creando usuario '{username}'...")
                    cur.execute(
                        "INSERT INTO users (username, email, hashed_password, is_active) VALUES (%s, %s, %s, TRUE) RETURNING id;",
                        (username, email, hashed)
                    )
                    user_id = cur.fetchone()[0]
                
                # Clean up existing roles for this user to reassign
                cur.execute("DELETE FROM user_roles WHERE user_id = %s;", (user_id,))
                
                # Assign roles
                for role_name in u["roles"]:
                    cur.execute("SELECT id FROM roles WHERE name = %s;", (role_name,))
                    role_row = cur.fetchone()
                    if not role_row:
                        print(f"  ADVERTENCIA: El rol '{role_name}' no existe en la base de datos.")
                        continue
                    role_id = role_row[0]
                    cur.execute(
                        "INSERT INTO user_roles (user_id, role_id) VALUES (%s, %s) ON CONFLICT DO NOTHING;",
                        (user_id, role_id)
                    )
                    print(f"  Rol '{role_name}' asignado a '{username}'.")
            
        conn.commit()

    print()
    print("=" * 72)
    print("  CONTRASEÑAS GENERADAS — cópialas ahora, no se vuelven a mostrar")
    print("=" * 72)
    for username, password in generadas:
        print(f"  {username:<22} {password}")
    print("=" * 72)
    print("  Entrégalas fuera de banda. NO las pegues en ningún archivo del repo.")
    print()
    print("Siembra de usuarios completada con éxito.")

if __name__ == "__main__":
    seed()
