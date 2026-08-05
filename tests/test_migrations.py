"""F-000 / T-12 — control de migraciones con checksum.

Criterios de aceptación que cubre:
  · reaplicar no duplica
  · editar una migración ya aplicada es detectado

No necesita base de datos: prueba la lógica de descubrimiento y verificación.
"""
import pytest

import run_migrations as rm


# ── Numeración ───────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "nombre,esperado",
    [
        ("000_base_schema.sql", "000"),
        ("044_rbac_permisos_logistica_huerfanos.sql", "044"),
        ("045b_min_stock.sql", "045b"),
        ("migrations/009_advanced_logistics.sql", "009"),
    ],
)
def test_extrae_la_version_del_nombre(nombre, esperado):
    assert rm._version_de(nombre) == esperado


def test_rechaza_migracion_sin_numero():
    with pytest.raises(rm.ErrorDeMigracion, match="número de versión"):
        rm._version_de("arreglo_rapido.sql")


# ── Checksum ─────────────────────────────────────────────────────────────────


def test_el_checksum_es_estable():
    sql = "CREATE TABLE x (id int);"
    assert rm._checksum(sql) == rm._checksum(sql)


def test_el_checksum_ignora_el_fin_de_linea_de_windows():
    """Un clon en Windows no debe invalidar migraciones aplicadas desde Linux."""
    assert rm._checksum("SELECT 1;\nSELECT 2;") == rm._checksum("SELECT 1;\r\nSELECT 2;")


def test_el_checksum_ignora_espacio_al_principio_y_al_final():
    assert rm._checksum("SELECT 1;") == rm._checksum("\n  SELECT 1;\n\n")


def test_el_checksum_cambia_si_cambia_el_sql():
    assert rm._checksum("SELECT 1;") != rm._checksum("SELECT 2;")


# ── Detección de migraciones alteradas ───────────────────────────────────────


def test_detecta_una_migracion_aplicada_que_fue_editada():
    """EL criterio de T-12: editar un archivo ya aplicado se detecta."""
    migraciones = [("044", "044_algo.sql", "migrations/044_algo.sql", "checksum_NUEVO")]
    aplicadas = {"044": ("044_algo.sql", "checksum_VIEJO")}

    problemas = rm._verificar_checksums(migraciones, aplicadas)

    assert len(problemas) == 1
    assert "cambió DESPUÉS de aplicarse" in problemas[0]
    assert "Regla 3" in problemas[0], "el mensaje debe recordar la regla de la constitución"


def test_detecta_una_migracion_aplicada_que_fue_renombrada():
    migraciones = [("044", "044_nombre_nuevo.sql", "ruta", "mismo_checksum")]
    aplicadas = {"044": ("044_nombre_viejo.sql", "mismo_checksum")}

    problemas = rm._verificar_checksums(migraciones, aplicadas)

    assert len(problemas) == 1
    assert "renombró" in problemas[0]


def test_no_hay_problema_si_nada_cambio():
    migraciones = [
        ("043", "043_a.sql", "ruta", "aaa"),
        ("044", "044_b.sql", "ruta", "bbb"),
    ]
    aplicadas = {"043": ("043_a.sql", "aaa"), "044": ("044_b.sql", "bbb")}

    assert rm._verificar_checksums(migraciones, aplicadas) == []


def test_una_migracion_pendiente_no_se_marca_como_alterada():
    """Lo que aún no se ha aplicado no tiene checksum contra el que comparar."""
    migraciones = [("045", "045_nueva.sql", "ruta", "ccc")]
    aplicadas = {}

    assert rm._verificar_checksums(migraciones, aplicadas) == []


# ── Descubrimiento sobre las migraciones reales del repo ─────────────────────


def test_todas_las_migraciones_del_repo_tienen_version_valida():
    """Si alguien añade un .sql mal nombrado, esto lo caza antes del deploy."""
    migraciones = rm._descubrir()
    assert migraciones, "no se descubrió ninguna migración"
    for version, nombre, _ruta, checksum in migraciones:
        assert version, f"'{nombre}' no produjo versión"
        assert len(checksum) == 64, f"'{nombre}' produjo un checksum que no es SHA-256"


def test_no_hay_numeros_de_migracion_duplicados():
    """Dos migraciones con el mismo número harían que una nunca se aplicara."""
    migraciones = rm._descubrir()  # lanza ErrorDeMigracion si hay duplicados
    versiones = [m[0] for m in migraciones]
    assert len(versiones) == len(set(versiones))


def test_las_migraciones_se_descubren_en_orden():
    versiones = [m[0] for m in rm._descubrir()]
    assert versiones == sorted(versiones), "el orden de aplicación debe ser determinista"


def test_reaplicar_no_duplica():
    """Con todo registrado, no queda nada pendiente: reejecutar es un no-op."""
    migraciones = rm._descubrir()
    aplicadas = {v: (n, c) for v, n, _r, c in migraciones}

    pendientes = [m for m in migraciones if m[0] not in aplicadas]

    assert pendientes == [], "una segunda pasada no debe volver a aplicar nada"
