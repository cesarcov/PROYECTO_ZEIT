"""Sube a Supabase Storage los logos y avatares que hoy están en disco local.

F-000 / T-11 — el disco de Render es efímero: lo que quede sólo en
`app/storage/` desaparece en el próximo redeploy. Este script lo mueve al
almacenamiento persistente y actualiza en la base de datos la URL nueva.

Es idempotente: las filas que ya apuntan a una URL http(s) se dejan como están.

Uso:
    python scripts/migrar_logos_a_storage.py --dry-run   # ver qué haría
    python scripts/migrar_logos_a_storage.py             # ejecutarlo
"""
import argparse
import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from psycopg2 import sql

from app.core.db import get_conn
from app.core.storage import (
    ArchivoInvalido,
    almacenamiento_es_persistente,
    obtener_almacen,
    validar_y_normalizar,
)

COLUMNAS_LOGO = {
    "logo_claro_path": "claro",
    "logo_oscuro_path": "oscuro",
    "isotipo_path": "isotipo",
    "favicon_path": "favicon",
}
CARPETA_BRANDING = os.path.join("app", "storage", "branding")
CARPETA_AVATARES = os.path.join("app", "storage", "avatars")


def _ya_es_url(valor: str | None) -> bool:
    return bool(valor) and valor.startswith(("http://", "https://"))


def _localizar(valor: str, carpeta: str) -> str | None:
    """Encuentra el archivo en disco a partir de lo guardado en la BD."""
    candidatos = [valor, os.path.join(carpeta, os.path.basename(valor))]
    for ruta in candidatos:
        if ruta and os.path.isfile(ruta):
            return ruta
    return None


def migrar_logos(dry_run: bool) -> int:
    almacen = obtener_almacen("branding")
    migrados = 0

    with get_conn(commit=not dry_run) as conn:
        with conn.cursor() as cur:
            columnas = list(COLUMNAS_LOGO)
            cur.execute(
                sql.SQL("SELECT {} FROM branding WHERE id = 1").format(
                    sql.SQL(", ").join(sql.Identifier(c) for c in columnas)
                )
            )
            fila = cur.fetchone()
            if not fila:
                print("  No hay fila de branding; nada que migrar.")
                return 0

            for columna, valor in zip(columnas, fila):
                variante = COLUMNAS_LOGO[columna]
                if not valor:
                    print(f"  --   {variante:<10} sin logo configurado")
                    continue
                if _ya_es_url(valor):
                    print(f"  OK   {variante:<10} ya está en almacenamiento remoto")
                    continue

                ruta = _localizar(valor, CARPETA_BRANDING)
                if not ruta:
                    print(f"  AVISO {variante:<10} la BD apunta a '{valor}' pero el archivo no existe")
                    continue

                with open(ruta, "rb") as f:
                    contenido = f.read()
                try:
                    limpio, ext, content_type = validar_y_normalizar(contenido)
                except ArchivoInvalido as e:
                    print(f"  ERROR {variante:<10} {e}")
                    continue

                if dry_run:
                    print(f"  [dry] {variante:<10} subiría {ruta} ({len(limpio)} bytes)")
                    migrados += 1
                    continue

                url = almacen.subir(f"{variante}{ext}", limpio, content_type)
                cur.execute(
                    sql.SQL("UPDATE branding SET {} = %s, updated_at = NOW() WHERE id = 1").format(
                        sql.Identifier(columna)
                    ),
                    (url,),
                )
                print(f"  OK   {variante:<10} -> {url}")
                migrados += 1

    return migrados


def migrar_avatares(dry_run: bool) -> int:
    almacen = obtener_almacen("avatars")
    migrados = 0

    with get_conn(commit=not dry_run) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, avatar_url FROM users "
                "WHERE avatar_url IS NOT NULL AND avatar_url <> ''"
            )
            filas = cur.fetchall()

            for user_id, username, avatar in filas:
                if _ya_es_url(avatar) or avatar.startswith("data:"):
                    continue

                ruta = _localizar(avatar, CARPETA_AVATARES)
                if not ruta:
                    print(f"  AVISO {username:<22} avatar '{avatar}' no existe en disco")
                    continue

                with open(ruta, "rb") as f:
                    contenido = f.read()
                try:
                    limpio, ext, content_type = validar_y_normalizar(contenido)
                except ArchivoInvalido as e:
                    print(f"  ERROR {username:<22} {e}")
                    continue

                if dry_run:
                    print(f"  [dry] {username:<22} subiría {ruta}")
                    migrados += 1
                    continue

                url = almacen.subir(f"{user_id}{ext}", limpio, content_type)
                cur.execute("UPDATE users SET avatar_url = %s WHERE id = %s", (url, user_id))
                print(f"  OK   {username:<22} -> {url}")
                migrados += 1

    return migrados


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="mostrar sin escribir nada")
    args = parser.parse_args()

    if not almacenamiento_es_persistente():
        print("ERROR: SUPABASE_URL / SUPABASE_SERVICE_KEY no están configurados.")
        print("Sin ellos el destino sería el mismo disco efímero: no hay nada que ganar.")
        return 1

    if args.dry_run:
        print("MODO SIMULACIÓN — no se escribe nada.\n")

    print("Logos de marca:")
    logos = migrar_logos(args.dry_run)
    print("\nAvatares de usuario:")
    avatares = migrar_avatares(args.dry_run)

    print(f"\n{logos} logo(s) y {avatares} avatar(es) procesados.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
