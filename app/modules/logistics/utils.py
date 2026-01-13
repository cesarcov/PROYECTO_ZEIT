# app/modules/logistics/utils.py
import pandas as pd

def read_excel(file):
    df = pd.read_excel(file)
    df = df.where(pd.notnull(df), None)  # NaN -> None
    return df


def build_movement_description(m, material_name, from_wh, to_wh):
    q = m["quantity"]

    if m["movement_type"] == "IN":
        return f"Ingreso de {q} {material_name} al {to_wh}"

    if m["movement_type"] == "OUT":
        return f"Salida de {q} {material_name} desde {from_wh}"

    if m["movement_type"] == "TRANSFER":
        return f"Transferencia de {q} {material_name} desde {from_wh} hacia {to_wh}"

    if m["movement_type"] == "RETURN":
        return f"Devolución de {q} {material_name} al {to_wh}"

    return "Movimiento desconocido"