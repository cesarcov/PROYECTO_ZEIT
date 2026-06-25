from datetime import datetime
from psycopg2 import sql


def generate_sequential_code(
    conn, table: str, prefix: str, year_based: bool = True, pad: int = 4
) -> str:
    """
    Genera un código secuencial con formato PREFIX-YYYY-NNNN (year_based=True)
    o PREFIX-NNNN (year_based=False). `pad` controla el ancho del número (default 4).

    Usa COUNT(*) sobre `table` para determinar el siguiente número.
    Debe llamarse dentro de una transacción abierta (recibe conn, no crea una nueva).
    """
    year = datetime.now().year
    with conn.cursor() as cur:
        if year_based:
            cur.execute(
                sql.SQL("SELECT COUNT(*) FROM {} WHERE EXTRACT(YEAR FROM created_at) = %s").format(
                    sql.Identifier(table)
                ),
                (year,),
            )
        else:
            cur.execute(sql.SQL("SELECT COUNT(*) FROM {}").format(sql.Identifier(table)))
        seq = cur.fetchone()[0] + 1

    num = str(seq).zfill(pad)
    if year_based:
        return f"{prefix}-{year}-{num}"
    return f"{prefix}-{num}"
