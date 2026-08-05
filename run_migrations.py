"""Aplica las migraciones SQL pendientes, con control de estado y checksum.

F-000 / T-12 — antes este script reejecutaba las 45 migraciones enteras en cada
llamada y se tragaba los errores como avisos. Ahora:

  · Lleva registro en la tabla `schema_migrations` (version, name, checksum,
    applied_at, applied_by).
  · Aplica SÓLO lo pendiente. Reejecutarlo no duplica nada.
  · Verifica el checksum SHA-256 de cada migración ya aplicada: si alguien
    editó un archivo que ya corrió en algún entorno, se detecta y se aborta
    (regla 3 de CONSTITUTION.md: una migración aplicada no se toca).
  · Cada migración corre en su propia transacción: o entra entera o no entra.

Uso:
    python run_migrations.py                # aplica lo pendiente
    python run_migrations.py --strict       # además falla si algo va mal (CI)
    python run_migrations.py --dry-run      # muestra el plan sin tocar nada
    python run_migrations.py --adopt        # marca lo existente como aplicado
    python run_migrations.py --verify-only  # sólo comprueba checksums
"""
import argparse
import getpass
import glob
import hashlib
import os
import re
import sys

from app.core.db import get_conn

CARPETA = "migrations"
_VERSION_RE = re.compile(r"^(\d+[a-z]?)")

TABLA_CONTROL = """
CREATE TABLE IF NOT EXISTS schema_migrations (
    version     TEXT PRIMARY KEY,
    name        TEXT        NOT NULL,
    checksum    TEXT        NOT NULL,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by  TEXT
)
"""


class ErrorDeMigracion(RuntimeError):
    pass


def _version_de(nombre_archivo: str) -> str:
    """'044_rbac_permisos.sql' -> '044'."""
    base = os.path.basename(nombre_archivo)
    match = _VERSION_RE.match(base)
    if not match:
        raise ErrorDeMigracion(
            f"'{base}' no empieza por un número de versión. "
            "Convención: NNN_descripcion.sql (p. ej. 045_nueva_tabla.sql)."
        )
    return match.group(1)


def _checksum(sql_texto: str) -> str:
    """SHA-256 del contenido normalizado (inmune a CRLF vs LF)."""
    normalizado = sql_texto.replace("\r\n", "\n").strip()
    return hashlib.sha256(normalizado.encode("utf-8")).hexdigest()


def _descubrir() -> list[tuple[str, str, str, str]]:
    """Devuelve [(version, nombre, ruta, checksum)] ordenado por versión."""
    encontradas = []
    vistas: dict[str, str] = {}

    for ruta in sorted(glob.glob(os.path.join(CARPETA, "*.sql"))):
        nombre = os.path.basename(ruta)
        version = _version_de(nombre)
        if version in vistas:
            raise ErrorDeMigracion(
                f"Versión duplicada '{version}': '{vistas[version]}' y '{nombre}'. "
                "Cada migración debe tener su propio número."
            )
        vistas[version] = nombre
        with open(ruta, encoding="utf-8") as f:
            contenido = f.read()
        encontradas.append((version, nombre, ruta, _checksum(contenido)))

    return encontradas


def _aplicadas(cur) -> dict[str, tuple[str, str]]:
    cur.execute("SELECT version, name, checksum FROM schema_migrations")
    return {fila[0]: (fila[1], fila[2]) for fila in cur.fetchall()}


def _la_bd_tiene_esquema(cur) -> bool:
    """¿La base ya tiene el esquema del ERP? Decide si hace falta --adopt."""
    cur.execute("SELECT to_regclass('public.users') IS NOT NULL")
    return bool(cur.fetchone()[0])


def _verificar_checksums(migraciones, aplicadas) -> list[str]:
    """Detecta migraciones ya aplicadas cuyo archivo cambió después."""
    alteradas = []
    for version, nombre, _ruta, checksum in migraciones:
        if version not in aplicadas:
            continue
        nombre_guardado, checksum_guardado = aplicadas[version]
        if checksum_guardado != checksum:
            alteradas.append(
                f"  {version} ({nombre}): el archivo cambió DESPUÉS de aplicarse.\n"
                f"      esperado: {checksum_guardado[:16]}...\n"
                f"      actual  : {checksum[:16]}...\n"
                f"      Regla 3: una migración aplicada no se edita. "
                f"Crea una migración nueva con el arreglo."
            )
        elif nombre_guardado != nombre:
            alteradas.append(
                f"  {version}: el archivo se renombró de '{nombre_guardado}' a '{nombre}'."
            )
    return alteradas


def ejecutar(dry_run=False, adopt=False, verify_only=False) -> int:
    """Devuelve el número de migraciones procesadas. Lanza ErrorDeMigracion si falla."""
    migraciones = _descubrir()
    if not migraciones:
        print(f"No se encontraron migraciones en '{CARPETA}/'.")
        return 0

    usuario = os.getenv("USER") or os.getenv("USERNAME") or getpass.getuser()

    with get_conn(commit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(TABLA_CONTROL)
            aplicadas = _aplicadas(cur)
            bd_con_esquema = _la_bd_tiene_esquema(cur)

    # 1. Integridad de lo ya aplicado ─────────────────────────────────────────
    alteradas = _verificar_checksums(migraciones, aplicadas)
    if alteradas:
        raise ErrorDeMigracion(
            "Se detectaron migraciones YA APLICADAS que fueron modificadas:\n"
            + "\n".join(alteradas)
        )
    print(
        f"Checksums verificados: {len(aplicadas)} migración(es) registrada(s), sin alteraciones."
    )

    if verify_only:
        return 0

    pendientes = [m for m in migraciones if m[0] not in aplicadas]
    if not pendientes:
        print("Todo al día: no hay migraciones pendientes.")
        return 0

    # 2. Adopción de una base preexistente ────────────────────────────────────
    if not aplicadas and bd_con_esquema and not adopt:
        raise ErrorDeMigracion(
            f"La base de datos YA tiene el esquema del ERP, pero la tabla de control "
            f"está vacía y hay {len(pendientes)} migración(es) sin registrar.\n\n"
            "Aplicarlas ahora reejecutaría migraciones que ya corrieron.\n"
            "Si esta base ya está al día, regístralas sin ejecutarlas:\n"
            "    python run_migrations.py --adopt"
        )

    if adopt:
        print(f"\nMODO ADOPCIÓN — se registran {len(pendientes)} migración(es) SIN ejecutarlas:")
        if dry_run:
            for version, nombre, _r, _c in pendientes:
                print(f"  [dry] {version}  {nombre}")
            return len(pendientes)
        with get_conn(commit=True) as conn:
            with conn.cursor() as cur:
                for version, nombre, _ruta, checksum in pendientes:
                    cur.execute(
                        "INSERT INTO schema_migrations (version, name, checksum, applied_by) "
                        "VALUES (%s, %s, %s, %s) ON CONFLICT (version) DO NOTHING",
                        (version, nombre, checksum, f"{usuario} (adopt)"),
                    )
                    print(f"  registrada  {version}  {nombre}")
        return len(pendientes)

    # 3. Aplicación normal ────────────────────────────────────────────────────
    print(f"\n{len(pendientes)} migración(es) pendiente(s):")
    procesadas = 0

    for version, nombre, ruta, checksum in pendientes:
        if dry_run:
            print(f"  [dry] {version}  {nombre}")
            procesadas += 1
            continue

        with open(ruta, encoding="utf-8") as f:
            sql_texto = f.read()

        try:
            # Una transacción por migración: entra entera o no entra.
            with get_conn(commit=True) as conn:
                with conn.cursor() as cur:
                    cur.execute(sql_texto)
                    cur.execute(
                        "INSERT INTO schema_migrations (version, name, checksum, applied_by) "
                        "VALUES (%s, %s, %s, %s)",
                        (version, nombre, checksum, usuario),
                    )
        except Exception as exc:
            raise ErrorDeMigracion(
                f"La migración {version} ({nombre}) falló y se revirtió por completo:\n  {exc}"
            )

        print(f"  OK    {version}  {nombre}")
        procesadas += 1

    return procesadas


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--strict", action="store_true",
                        help="salir con código != 0 ante cualquier fallo (para CI)")
    parser.add_argument("--dry-run", action="store_true",
                        help="mostrar el plan sin escribir nada")
    parser.add_argument("--adopt", action="store_true",
                        help="registrar las migraciones existentes SIN ejecutarlas")
    parser.add_argument("--verify-only", action="store_true",
                        help="sólo verificar los checksums de lo ya aplicado")
    args = parser.parse_args()

    try:
        total = ejecutar(dry_run=args.dry_run, adopt=args.adopt, verify_only=args.verify_only)
    except ErrorDeMigracion as exc:
        print(f"\nERROR: {exc}\n", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"\nERROR inesperado: {exc}\n", file=sys.stderr)
        return 1

    if not args.verify_only:
        print(f"\n{total} migración(es) procesada(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
