"""Introspección del RBAC declarado en las rutas de FastAPI.

F-000 / T-10 — recorre el árbol de dependencias de cada ruta registrada y
clasifica su nivel de protección. Es lo que permite a `test_rbac_matrix.py`
aplicar deny-by-default sin depender de convenciones de nombres.

Clasificación:
  · `con_permiso`  — declara `require_permission(...)`: es el objetivo (OBJ-4).
  · `sin_permiso`  — sólo exige estar autenticado. Es DEUDA: cualquier usuario
                     con sesión puede llamarla, sin importar su rol.
  · `publicas`     — no exige nada. Sólo pueden serlo las de la lista blanca.
"""
from fastapi.routing import APIRoute


def _analizar(dependant) -> tuple[set[str], bool]:
    """Devuelve (permisos declarados, exige_autenticacion) de una ruta."""
    permisos: set[str] = set()
    exige_auth = False
    vistos: set[int] = set()
    pila = [dependant]

    while pila:
        actual = pila.pop()
        if id(actual) in vistos:
            continue
        vistos.add(id(actual))

        call = getattr(actual, "call", None)
        if call is not None:
            # Marca puesta por require_permission() — ver app/core/security/permissions.py
            permisos.update(getattr(call, "__erp_permissions__", ()))
            if getattr(call, "__erp_solo_autenticado__", False):
                exige_auth = True
            if getattr(call, "__name__", "") == "get_current_user":
                exige_auth = True

        pila.extend(getattr(actual, "dependencies", []))

    return permisos, exige_auth


def etiqueta_de_ruta(route: APIRoute) -> str:
    """Identificador estable de una ruta: 'GET /logistics/materials'."""
    metodos = ",".join(sorted(route.methods - {"HEAD", "OPTIONS"}))
    return f"{metodos} {route.path}"


def inventario_de_rutas(app=None) -> dict:
    """Clasifica TODAS las rutas de la app por su nivel de protección."""
    if app is None:
        from app.main import app as app_real

        app = app_real

    con_permiso: dict[str, list[str]] = {}
    sin_permiso: list[str] = []
    publicas: list[str] = []

    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        permisos, exige_auth = _analizar(route.dependant)
        etiqueta = etiqueta_de_ruta(route)

        if permisos:
            con_permiso[etiqueta] = sorted(permisos)
        elif exige_auth:
            sin_permiso.append(etiqueta)
        else:
            publicas.append(etiqueta)

    return {
        "con_permiso": con_permiso,
        "sin_permiso": sorted(sin_permiso),
        "publicas": sorted(publicas),
    }
