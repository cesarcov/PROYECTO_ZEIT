import logging
import os
import secrets
import shutil
import string
import subprocess
from pathlib import Path
from uuid import UUID

import psycopg2
from fastapi import HTTPException

from app.core.blocks import VALID_BLOCKS, VALID_LEVELS
from app.core.config import settings
from app.core.database import _parse_db_url, db_connection
from app.core.master_db import master_db_connection
from app.core.security.hashing import hash_password
from app.modules.superadmin.schemas import TenantCreate

logger = logging.getLogger(__name__)


# ── Block services ─────────────────────────────────────────────────────────────

def get_users_with_blocks_service() -> list[dict]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT u.id, u.username, u.email, u.is_active,
                       ubp.block_slug, ubp.level
                FROM users u
                LEFT JOIN user_block_permissions ubp ON ubp.user_id = u.id
                ORDER BY u.username, ubp.block_slug
            """)
            rows = cur.fetchall()

    users: dict[str, dict] = {}
    for row in rows:
        uid, username, email, is_active, block_slug, level = row
        uid_str = str(uid)
        if uid_str not in users:
            users[uid_str] = {
                "id": uid_str, "username": username,
                "email": email, "is_active": is_active, "blocks": [],
            }
        if block_slug:
            users[uid_str]["blocks"].append({"slug": block_slug, "level": level})
    return list(users.values())


def get_user_blocks_by_id_service(user_id: str) -> dict:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Usuario no encontrado")
            username = row[0]

            cur.execute("""
                SELECT block_slug, level, granted_at
                FROM user_block_permissions
                WHERE user_id = %s
            """, (user_id,))
            assigned = {r[0]: {"level": r[1], "granted_at": r[2]} for r in cur.fetchall()}

    blocks = []
    for slug in VALID_BLOCKS:
        if slug in assigned:
            blocks.append({
                "slug": slug,
                "level": assigned[slug]["level"],
                "granted_at": assigned[slug]["granted_at"],
            })
        else:
            blocks.append({"slug": slug, "level": None, "granted_at": None})

    return {"user_id": user_id, "username": username, "blocks": blocks}


def set_user_blocks_service(user_id: str, blocks: list[dict], granted_by: str | None) -> dict:
    for b in blocks:
        if b["slug"] not in VALID_BLOCKS:
            raise HTTPException(422, f"Bloque inválido: {b['slug']}")
        if b["level"] not in VALID_LEVELS:
            raise HTTPException(422, f"Nivel inválido: {b['level']}")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Usuario no encontrado")
            username = row[0]

            cur.execute("DELETE FROM user_block_permissions WHERE user_id = %s", (user_id,))
            for b in blocks:
                cur.execute("""
                    INSERT INTO user_block_permissions (user_id, block_slug, level, granted_by)
                    VALUES (%s, %s, %s, %s)
                """, (user_id, b["slug"], b["level"], granted_by))
        conn.commit()

    return get_user_blocks_by_id_service(user_id)


# ── Tenant services ────────────────────────────────────────────────────────────

# Esquema base (pg_dump del estado actual) — usado para nuevas DBs de tenant
_BASE_SCHEMA = "migrations/000_base_schema.sql"


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def _find_psql() -> str:
    """Localiza el ejecutable psql en el PATH o en rutas conocidas de Windows."""
    psql = shutil.which("psql")
    if psql:
        return psql
    candidates = [
        r"C:\Program Files\PostgreSQL\18\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\17\bin\psql.exe",
        r"C:\Program Files\PostgreSQL\16\bin\psql.exe",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
    raise RuntimeError("psql no encontrado. Asegúrate de que PostgreSQL esté en el PATH.")


def _run_migrations(db_name: str, pg: dict) -> None:
    """Aplica el esquema base al nuevo tenant DB usando psql."""
    schema_path = Path(_BASE_SCHEMA)
    if not schema_path.exists():
        raise RuntimeError(f"Esquema base no encontrado: {_BASE_SCHEMA}")

    psql_bin = _find_psql()
    env = {**os.environ, "PGPASSWORD": pg["password"]}

    result = subprocess.run(
        [
            psql_bin,
            "-U", pg["user"],
            "-h", pg["host"],
            "-p", str(pg["port"]),
            "-d", db_name,
            "-f", str(schema_path.resolve()),
        ],
        env=env,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(result.stderr[:500] or result.stdout[:500])


def _create_admin_user(db_url: str, admin_email: str, temp_password: str) -> None:
    hashed = hash_password(temp_password)
    conn = psycopg2.connect(**_parse_db_url(db_url))
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO users (username, email, hashed_password, is_active)
                VALUES ('admin', %s, %s, TRUE)
                ON CONFLICT (username) DO NOTHING
            """, (admin_email, hashed))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def provision_tenant(payload: TenantCreate) -> dict:
    slug = payload.slug
    db_name = f"erp_{slug}"

    # Obtener credenciales de conexión del servidor PostgreSQL
    master_url = settings.MASTER_DATABASE_URL or settings.DATABASE_URL
    pg = _parse_db_url(master_url)

    # Paso 1: INSERT en master DB con status=pending
    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id FROM tenants WHERE slug = %s",
                (slug,),
            )
            if cur.fetchone():
                raise HTTPException(409, f"Ya existe un tenant con el slug '{slug}'.")

        with conn.cursor() as cur:
            db_url = f"postgresql://{pg['user']}:{pg['password']}@{pg['host']}:{pg['port']}/{db_name}"
            cur.execute("""
                INSERT INTO tenants (name, slug, db_name, db_url, is_active, provision_status)
                VALUES (%s, %s, %s, %s, TRUE, 'pending')
                RETURNING id
            """, (payload.name, slug, db_name, db_url))
            tenant_id = cur.fetchone()[0]
        conn.commit()

    temp_password = _generate_temp_password()

    def _mark_error(msg: str):
        with master_db_connection() as c:
            with c.cursor() as cur:
                cur.execute(
                    "UPDATE tenants SET provision_status='error', provision_error=%s WHERE id=%s",
                    (msg, tenant_id),
                )
            c.commit()

    # Paso 2: CREATE DATABASE (requiere autocommit=True)
    try:
        raw = psycopg2.connect(**{**pg, "database": "postgres"})
        raw.autocommit = True
        with raw.cursor() as cur:
            cur.execute(f'CREATE DATABASE "{db_name}"')
        raw.close()
    except Exception as e:
        _mark_error(str(e))
        raise HTTPException(500, f"Error creando la base de datos del tenant: {e}")

    # Paso 3: Aplicar esquema base al nuevo tenant DB
    try:
        _run_migrations(db_name, pg)
    except Exception as e:
        _mark_error(str(e))
        raise HTTPException(500, f"Error ejecutando migraciones: {e}")

    # Paso 4: Crear usuario admin en la nueva DB
    try:
        _create_admin_user(
            f"postgresql://{pg['user']}:{pg['password']}@{pg['host']}:{pg['port']}/{db_name}",
            payload.admin_email,
            temp_password,
        )
    except Exception as e:
        _mark_error(str(e))
        raise HTTPException(500, f"Error creando usuario admin: {e}")

    # Paso 5: Marcar como activo
    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE tenants SET provision_status='active' WHERE id=%s RETURNING created_at",
                (tenant_id,),
            )
            created_at = cur.fetchone()[0]
        conn.commit()

    # SECURITY: contraseña temporal retornada una sola vez en este response.
    # Requiere HTTPS en producción. El superadmin debe comunicarla al cliente
    # por canal seguro y el admin debe cambiarla en el primer login.
    logger.info("Tenant '%s' provisionado. Admin: admin@%s (credencial one-time generada)", slug, payload.admin_email)

    return {
        "id": tenant_id,
        "name": payload.name,
        "slug": slug,
        "is_active": True,
        "provision_status": "active",
        "created_at": created_at,
        "admin_username": "admin",
        "admin_temp_password": temp_password,
    }


def list_tenants() -> list[dict]:
    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, slug, is_active, provision_status, created_at
                FROM tenants
                ORDER BY created_at DESC
            """)
            rows = cur.fetchall()
    return [
        {
            "id": r[0], "name": r[1], "slug": r[2],
            "is_active": r[3], "provision_status": r[4], "created_at": r[5],
        }
        for r in rows
    ]


def get_tenant(tenant_id: UUID) -> dict:
    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, slug, db_name, is_active, provision_status, provision_error, created_at
                FROM tenants WHERE id = %s
            """, (str(tenant_id),))
            row = cur.fetchone()
    if not row:
        raise HTTPException(404, "Tenant no encontrado.")
    return {
        "id": row[0], "name": row[1], "slug": row[2], "db_name": row[3],
        "is_active": row[4], "provision_status": row[5],
        "provision_error": row[6], "created_at": row[7],
    }


def update_tenant_status(tenant_id: UUID, is_active: bool) -> dict:
    from app.core.tenant_middleware import invalidate_tenant_cache

    with master_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE tenants SET is_active = %s
                WHERE id = %s
                RETURNING id, name, slug, is_active, provision_status, created_at
            """, (is_active, str(tenant_id)))
            row = cur.fetchone()
        conn.commit()

    if not row:
        raise HTTPException(404, "Tenant no encontrado.")

    # Invalidar cache para que el cambio sea inmediato
    invalidate_tenant_cache(row[2])

    return {
        "id": row[0], "name": row[1], "slug": row[2],
        "is_active": row[3], "provision_status": row[4], "created_at": row[5],
    }
