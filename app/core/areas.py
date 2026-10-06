"""Áreas funcionales del ERP y qué rutas pertenece a cada una.

Fuente ÚNICA de verdad para el lanzamiento por fases: el backend decide aquí
qué cerrar, y `frontend/myapp/src/constants/areas.js` es su espejo para decidir
qué ocultar del sidebar. Si cambias una, cambia la otra.

Por qué existe: los módulos del ERP no están separados limpiamente. El sidebar
de Logística enlaza a `/compras` y `/ot`; el de Admin enlaza a `/planificacion`
y `/clientes`. Cerrar "todo menos Logística" por módulo dejaría enlaces
muertos, así que la unidad de control es el ÁREA y el mapa de prefijos es
explícito.

Las áreas en beta NO se deciden aquí: salen de la variable de entorno
`MODULOS_BETA`. Así, soltar un módulo al público es quitarlo de esa lista y
redesplegar — sin tocar código ni base de datos.
"""

# Área -> prefijos de URL del backend que le pertenecen.
# El orden importa: se busca el prefijo MÁS LARGO primero, para que
# `/admin/planificacion` gane sobre `/admin`.
AREAS: dict[str, tuple[str, ...]] = {
    # ── Siempre públicas: son el núcleo o son transversales ──────────────────
    "logistica": ("/logistics", "/materials"),
    "admin": ("/admin",),
    "solicitudes": ("/requests", "/reservations"),
    # ── Candidatas a beta ────────────────────────────────────────────────────
    "operaciones": ("/operations", "/ot", "/operaciones"),
    "cotizaciones": ("/cotizaciones",),
    "compras": ("/compras",),
    "clientes": ("/clientes",),
    "canal": ("/canal",),
    "gerencia": ("/gerencia",),
    "planificacion": ("/planificacion",),
    "requerimientos": ("/requerimientos",),
}

# Rutas que NUNCA se cierran, pase lo que pase. Sin ellas no se puede ni
# entrar a la aplicación, ni diagnosticarla, ni recuperarse de un gate mal
# configurado.
PREFIJOS_EXENTOS: tuple[str, ...] = (
    "/",                  # ping
    "/health",            # monitor externo (F-000 / T-05)
    "/auth",              # login, refresh, logout, perfil, preferencias
    "/branding",          # la pantalla de login lo necesita antes de autenticar
    "/branding-assets",   # logos
    "/avatar-assets",     # avatares
    "/superadmin",        # administración maestra: ya exige rol superadmin
    "/reporting",         # KPIs agregados del inicio; ver nota de abajo
    "/search",            # buscador global; filtra por área en su servicio
    "/docs",
    "/redoc",
    "/openapi.json",
)

# Áreas que nunca pueden declararse beta: cerrarlas dejaría el ERP inservible.
AREAS_NO_CERRABLES: frozenset[str] = frozenset({"logistica", "admin", "solicitudes"})

# Permiso implícito: quien es beta tester ve y usa todo.
# (Se resuelve por `BETA_TESTERS` en la configuración, no por RBAC.)


def area_de_ruta(path: str) -> str | None:
    """Área a la que pertenece una ruta, o None si está exenta o no mapeada.

    Se compara por prefijo de SEGMENTO: `/clientes` cubre `/clientes` y
    `/clientes/123`, pero no `/clientesfalsos`.
    """
    if _coincide_alguno(path, PREFIJOS_EXENTOS):
        return None

    # Prefijo más largo primero: `/admin/planificacion` antes que `/admin`.
    candidatos = sorted(
        ((prefijo, area) for area, prefijos in AREAS.items() for prefijo in prefijos),
        key=lambda par: len(par[0]),
        reverse=True,
    )
    for prefijo, area in candidatos:
        if _coincide(path, prefijo):
            return area
    return None


def _coincide(path: str, prefijo: str) -> bool:
    if prefijo == "/":
        return path == "/"
    return path == prefijo or path.startswith(prefijo + "/") or path.startswith(prefijo + "?")


def _coincide_alguno(path: str, prefijos: tuple[str, ...]) -> bool:
    return any(_coincide(path, p) for p in prefijos)


def validar_areas_beta(declaradas: list[str]) -> tuple[list[str], list[str]]:
    """Separa las áreas beta válidas de los problemas.

    Devuelve (areas_validas, avisos). Un nombre mal escrito en `MODULOS_BETA`
    pasaría desapercibido y dejaría el módulo abierto al público creyendo que
    estaba cerrado, así que se avisa en el arranque.
    """
    validas, avisos = [], []
    for area in declaradas:
        if area not in AREAS:
            avisos.append(
                f"'{area}' no es un área conocida; se ignora. "
                f"Válidas: {', '.join(sorted(AREAS))}"
            )
        elif area in AREAS_NO_CERRABLES:
            avisos.append(
                f"'{area}' no se puede poner en beta (el ERP quedaría inservible); se ignora."
            )
        else:
            validas.append(area)
    return validas, avisos
