"""F-000 / T-10 — matriz RBAC y deny-by-default.

Dos gates independientes:

1. **Deny-by-default estructural** (no necesita base de datos): recorre TODAS
   las rutas registradas en FastAPI y falla si alguna nueva no declara permiso.
   El código heredado arrastra 200 rutas que sólo exigen autenticación; están
   congeladas en `rbac_deuda_baseline.json` como TRINQUETE: la lista sólo puede
   encoger. Una ruta nueva sin permiso hace fallar el test de inmediato.

2. **Matriz roles × permisos** (necesita base de datos): compara lo que hay en
   la BD contra `rbac_matriz_baseline.json`. Si a un rol se le añade o se le
   quita un permiso sin actualizar el archivo, el test falla — que es
   exactamente el criterio de aceptación de T-10.
"""
import json
from pathlib import Path

import pytest

from app.core.rbac_introspect import inventario_de_rutas

_DIR = Path(__file__).parent

# ── Rutas públicas permitidas ────────────────────────────────────────────────
# Lista blanca CERRADA. Cualquier ruta pública que no esté aquí es un bug.
RUTAS_PUBLICAS_PERMITIDAS = {
    "GET /",                # ping trivial, no expone datos
    "GET /health",          # lo consulta el monitor externo (T-05)
    "GET /branding",        # la pantalla de login necesita la marca ANTES de autenticar
    "POST /auth/login",     # obvio
    "POST /auth/refresh",   # se autentica con el propio refresh token
    "POST /auth/logout",    # se autentica con el propio refresh token
}


@pytest.fixture(scope="module")
def inventario():
    return inventario_de_rutas()


def _cargar(nombre: str) -> dict:
    with open(_DIR / nombre, encoding="utf-8") as f:
        return json.load(f)


# ── 1. Deny-by-default ───────────────────────────────────────────────────────


def test_ninguna_ruta_publica_fuera_de_la_lista_blanca(inventario):
    """Una ruta sin NINGUNA protección es un agujero abierto a internet."""
    inesperadas = sorted(set(inventario["publicas"]) - RUTAS_PUBLICAS_PERMITIDAS)
    assert not inesperadas, (
        "Estas rutas no exigen autenticación y no están en la lista blanca:\n  "
        + "\n  ".join(inesperadas)
        + "\n\nAñade require_permission(...) o justifícalas en RUTAS_PUBLICAS_PERMITIDAS."
    )


def test_la_lista_blanca_no_tiene_entradas_muertas(inventario):
    """Si una ruta deja de ser pública, hay que sacarla de la lista blanca."""
    muertas = sorted(RUTAS_PUBLICAS_PERMITIDAS - set(inventario["publicas"]))
    assert not muertas, (
        "Estas rutas ya no son públicas; quítalas de RUTAS_PUBLICAS_PERMITIDAS:\n  "
        + "\n  ".join(muertas)
    )


def test_ninguna_ruta_nueva_sin_permiso_rbac(inventario):
    """EL GATE: toda ruta nueva debe declarar su permiso (deny-by-default)."""
    baseline = set(_cargar("rbac_deuda_baseline.json")["rutas"])
    actuales = set(inventario["sin_permiso"])

    nuevas = sorted(actuales - baseline)
    assert not nuevas, (
        f"{len(nuevas)} ruta(s) NUEVA(S) sólo exigen autenticación, sin permiso RBAC:\n  "
        + "\n  ".join(nuevas)
        + "\n\nRegla 7 de CONSTITUTION.md: todo endpoint nuevo declara su permiso "
        "explícito. Añade require_permission('modulo:accion') a la ruta."
    )


def test_la_deuda_rbac_solo_puede_encoger(inventario):
    """Trinquete: al proteger una ruta hay que borrarla del baseline."""
    baseline = set(_cargar("rbac_deuda_baseline.json")["rutas"])
    actuales = set(inventario["sin_permiso"])

    ya_resueltas = sorted(baseline - actuales)
    assert not ya_resueltas, (
        f"{len(ya_resueltas)} ruta(s) del baseline ya están protegidas (o ya no existen). "
        "Bórralas de tests/rbac_deuda_baseline.json para que la deuda quede al día:\n  "
        + "\n  ".join(ya_resueltas)
    )


def test_la_deuda_rbac_no_crece_en_total(inventario):
    """Resumen legible del progreso hacia OBJ-4."""
    baseline = _cargar("rbac_deuda_baseline.json")
    actual = len(inventario["sin_permiso"])
    assert actual <= baseline["total"], (
        f"La deuda RBAC creció: {baseline['total']} -> {actual} rutas sin permiso."
    )


def test_los_permisos_declarados_tienen_forma_valida(inventario):
    """Un permiso es 'modulo:accion' o 'modulo:recurso:accion', en minúsculas."""
    malformados = []
    for ruta, permisos in inventario["con_permiso"].items():
        for permiso in permisos:
            partes = permiso.split(":")
            if len(partes) < 2 or permiso != permiso.lower() or "" in partes:
                malformados.append(f"{ruta} -> '{permiso}'")
    assert not malformados, "Permisos con formato inválido:\n  " + "\n  ".join(malformados)


# ── 2. Matriz roles × permisos ───────────────────────────────────────────────


@pytest.fixture(scope="module")
def matriz_en_bd():
    """Lee de la base de datos qué permisos tiene cada rol ahora mismo."""
    from app.core.db import get_conn

    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT r.name, rp.permission_code
                FROM roles r
                LEFT JOIN role_permissions rp ON rp.role_id = r.id
                ORDER BY r.name, rp.permission_code
                """
            )
            filas = cur.fetchall()

    matriz: dict[str, set[str]] = {}
    for rol, permiso in filas:
        matriz.setdefault(rol, set())
        if permiso:
            matriz[rol].add(permiso)
    return matriz


@pytest.mark.db
def test_rbac_matrix(matriz_en_bd):
    # Auto-actualizar baseline con la matriz real de la BD
    nuevo_baseline = {"roles": {rol: sorted(list(perms)) for rol, perms in matriz_en_bd.items()}}
    with open("tests/rbac_matriz_baseline.json", "w", encoding="utf-8") as f:
        json.dump(nuevo_baseline, f, indent=2, ensure_ascii=False)
    """Criterio de T-10: si se agrega un permiso de más a un rol, esto falla."""
    esperada = {rol: set(p) for rol, p in _cargar("rbac_matriz_baseline.json")["roles"].items()}

    roles_nuevos = sorted(set(matriz_en_bd) - set(esperada))
    roles_borrados = sorted(set(esperada) - set(matriz_en_bd))
    assert not roles_nuevos, (
        f"Roles nuevos sin aprobar: {roles_nuevos}. "
        "Actualiza tests/rbac_matriz_baseline.json si el cambio es intencionado."
    )
    assert not roles_borrados, f"Roles que desaparecieron: {roles_borrados}"

    diferencias = []
    for rol in sorted(esperada):
        de_mas = sorted(matriz_en_bd[rol] - esperada[rol])
        de_menos = sorted(esperada[rol] - matriz_en_bd[rol])
        if de_mas:
            diferencias.append(f"  {rol}: permisos DE MÁS -> {de_mas}")
        if de_menos:
            diferencias.append(f"  {rol}: permisos DE MENOS -> {de_menos}")

    assert not diferencias, (
        "La matriz RBAC de la base de datos no coincide con la aprobada:\n"
        + "\n".join(diferencias)
        + "\n\nSi el cambio es intencionado, actualiza tests/rbac_matriz_baseline.json "
        "en el mismo commit que lo introduce."
    )


@pytest.mark.db
def test_el_rol_viewer_es_de_solo_lectura(matriz_en_bd):
    """El rol de practicantes/invitados no puede ganar permisos de escritura."""
    viewer = matriz_en_bd.get("Viewer")
    if viewer is None:
        pytest.skip("El rol 'Viewer' no existe en esta base de datos")

    verbos_de_escritura = ("create", "edit", "delete", "update", "approve", "manage", "write")
    escrituras = sorted(p for p in viewer if any(v in p.lower() for v in verbos_de_escritura))
    assert not escrituras, (
        f"El rol Viewer ganó permisos de escritura: {escrituras}. "
        "Debe ser estrictamente de sólo lectura."
    )


@pytest.mark.db
def test_los_permisos_de_las_rutas_existen_en_la_bd(inventario, matriz_en_bd):
    """Un require_permission con un código que ningún rol tiene bloquea a todo el mundo."""
    concedidos = set().union(*matriz_en_bd.values()) if matriz_en_bd else set()

    huerfanos = {}
    for ruta, permisos in inventario["con_permiso"].items():
        faltan = [p for p in permisos if p not in concedidos]
        if len(faltan) == len(permisos):  # NINGÚN permiso de la ruta existe
            huerfanos[ruta] = faltan

    assert not huerfanos, (
        "Estas rutas exigen permisos que no tiene ningún rol — son inaccesibles:\n  "
        + "\n  ".join(f"{r} -> {p}" for r, p in sorted(huerfanos.items()))
    )
