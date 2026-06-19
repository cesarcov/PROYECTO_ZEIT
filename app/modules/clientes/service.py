from datetime import datetime
from fastapi import HTTPException
from app.core.database import db_connection


def _gen_cliente_code(conn) -> str:
    year = datetime.now().year
    with conn.cursor() as cur:
        cur.execute(
            "SELECT COUNT(*) FROM clientes WHERE codigo LIKE %s",
            (f"CLI-{year}-%",)
        )
        seq = cur.fetchone()[0] + 1
    return f"CLI-{year}-{seq:04d}"


def _row_to_cliente(r, contactos=None) -> dict:
    return {
        "id": str(r[0]), "codigo": r[1], "razon_social": r[2],
        "ruc": r[3], "direccion": r[4], "telefono": r[5],
        "email": r[6], "contacto": r[7], "cargo_contacto": r[8],
        "activo": r[9], "notas": r[10],
        "created_at": r[11].isoformat() if r[11] else None,
        "contactos": contactos if contactos is not None else [],
    }


def list_clientes_service(solo_activos: bool = False) -> list:
    with db_connection() as conn:
        with conn.cursor() as cur:
            q = """
                SELECT id, codigo, razon_social, ruc, direccion, telefono,
                       email, contacto, cargo_contacto, activo, notas, created_at
                FROM clientes
            """
            if solo_activos:
                q += " WHERE activo = TRUE"
            q += " ORDER BY razon_social"
            cur.execute(q)
            rows = cur.fetchall()
            
            cur.execute("""
                SELECT cc.id, cc.cliente_id, cc.nombre, cc.cargo, cc.telefono, cc.email,
                       (SELECT COUNT(*) FROM presupuesto_config pc WHERE pc.contacto_id = cc.id) AS total_cotizaciones
                FROM cliente_contactos cc
                ORDER BY cc.nombre
            """)
            contactos_by_cliente = {}
            for cid, cliente_id, nombre, cargo, telefono, email, total_cot in cur.fetchall():
                c_id = str(cliente_id)
                if c_id not in contactos_by_cliente:
                    contactos_by_cliente[c_id] = []
                contactos_by_cliente[c_id].append({
                    "id": str(cid),
                    "nombre": nombre,
                    "cargo": cargo,
                    "telefono": telefono,
                    "email": email,
                    "total_cotizaciones": total_cot or 0
                })
    return [_row_to_cliente(r, contactos_by_cliente.get(str(r[0]), [])) for r in rows]


def create_cliente_service(payload) -> dict:
    with db_connection() as conn:
        if payload.ruc:
            with conn.cursor() as cur:
                cur.execute("SELECT id FROM clientes WHERE ruc = %s", (payload.ruc.strip(),))
                if cur.fetchone():
                    raise HTTPException(400, f"Ya existe un cliente con RUC {payload.ruc}")
        codigo = _gen_cliente_code(conn)
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO clientes
                    (codigo, razon_social, ruc, direccion, telefono, email, contacto, cargo_contacto, notas)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, codigo, razon_social, ruc, direccion, telefono,
                          email, contacto, cargo_contacto, activo, notas, created_at
            """, (
                codigo,
                payload.razon_social.strip(),
                payload.ruc.strip() if payload.ruc else None,
                payload.direccion,
                payload.telefono,
                payload.email,
                payload.contacto,
                payload.cargo_contacto,
                payload.notas,
            ))
            row = cur.fetchone()
            conn.commit()
    return _row_to_cliente(row)


def update_cliente_service(cliente_id: str, payload) -> dict:
    fields, vals = [], []
    mapping = [
        ("razon_social", payload.razon_social),
        ("ruc", payload.ruc),
        ("direccion", payload.direccion),
        ("telefono", payload.telefono),
        ("email", payload.email),
        ("contacto", payload.contacto),
        ("cargo_contacto", payload.cargo_contacto),
        ("activo", payload.activo),
        ("notas", payload.notas),
    ]
    for col, val in mapping:
        if val is not None:
            fields.append(f"{col} = %s")
            vals.append(val.strip() if isinstance(val, str) else val)
    if not fields:
        raise HTTPException(400, "Nada que actualizar")
    fields.append("updated_at = NOW()")
    vals.append(cliente_id)
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"UPDATE clientes SET {', '.join(fields)} WHERE id = %s "
                "RETURNING id, codigo, razon_social, ruc, direccion, telefono, "
                "email, contacto, cargo_contacto, activo, notas, created_at",
                vals,
            )
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cliente no encontrado")
            
            cur.execute("""
                SELECT cc.id, cc.nombre, cc.cargo, cc.telefono, cc.email,
                       (SELECT COUNT(*) FROM presupuesto_config pc WHERE pc.contacto_id = cc.id) AS total_cotizaciones
                FROM cliente_contactos cc
                WHERE cc.cliente_id = %s
                ORDER BY cc.nombre
            """, (cliente_id,))
            contactos = [
                {
                    "id": str(cid),
                    "nombre": nombre,
                    "cargo": cargo,
                    "telefono": telefono,
                    "email": email,
                    "total_cotizaciones": total_cot or 0
                }
                for cid, nombre, cargo, telefono, email, total_cot in cur.fetchall()
            ]
            conn.commit()
    return _row_to_cliente(row, contactos)


def get_cliente_stats_service(cliente_id: str) -> dict:
    """Resumen comercial y operativo del cliente."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, razon_social FROM clientes WHERE id = %s", (cliente_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Cliente no encontrado")
            razon = row[1]

            cur.execute(
                "SELECT status, COUNT(*) FROM presupuesto_config WHERE cliente_id = %s GROUP BY status",
                (cliente_id,),
            )
            cotizaciones_por_estado = {r[0]: r[1] for r in cur.fetchall()}

            cur.execute("""
                SELECT COUNT(*)
                FROM ordenes_trabajo ot
                JOIN presupuesto_config pc ON pc.plan_id = ot.plan_id
                WHERE pc.cliente_id = %s AND ot.status IN ('PENDIENTE', 'EN_EJECUCION', 'PAUSADA')
            """, (cliente_id,))
            ots_en_ejecucion = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*)
                FROM ordenes_trabajo ot
                JOIN presupuesto_config pc ON pc.plan_id = ot.plan_id
                WHERE pc.cliente_id = %s AND ot.status IN ('COMPLETADA', 'CERRADA')
            """, (cliente_id,))
            ots_completadas = cur.fetchone()[0]

            cur.execute("""
                SELECT COUNT(*)
                FROM planificacion_semanal
                WHERE LOWER(cliente) = LOWER(%s)
                  AND estado NOT IN ('Completado', 'Cancelado')
            """, (razon,))
            actividades_activas = cur.fetchone()[0]

    total_cot = sum(cotizaciones_por_estado.values())
    aprobadas = cotizaciones_por_estado.get("APROBADA", 0)
    return {
        "total_cotizaciones": total_cot,
        "cotizaciones_por_estado": cotizaciones_por_estado,
        "aprobadas": aprobadas,
        "tasa_aprobacion": round((aprobadas / total_cot) * 100) if total_cot else 0,
        "ots_en_ejecucion": ots_en_ejecucion,
        "ots_completadas": ots_completadas,
        "actividades_activas": actividades_activas,
    }


def get_cliente_cotizaciones_service(cliente_id: str) -> list:
    """Historial de cotizaciones del cliente con resumen económico."""
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM clientes WHERE id = %s", (cliente_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Cliente no encontrado")
            cur.execute("""
                SELECT
                    pc.id,
                    pc.numero_cotizacion,
                    pc.status,
                    pc.fecha_envio,
                    pc.fecha_respuesta,
                    pc.moneda,
                    pp.project_code   AS plan_code,
                    pp.title  AS plan_title,
                    pp.id     AS plan_id,
                    pc.lugar_trabajo,
                    pc.plazo_dias,
                    pc.created_at,
                    pc.gastos_generales_pct,
                    pc.utilidad_pct,
                    pc.igv_pct,
                    pc.contacto_id,
                    cc.nombre AS contacto_nombre
                FROM presupuesto_config pc
                JOIN project_plans pp ON pp.id = pc.plan_id
                LEFT JOIN cliente_contactos cc ON cc.id = pc.contacto_id
                WHERE pc.cliente_id = %s
                ORDER BY pc.created_at DESC
            """, (cliente_id,))
            rows = cur.fetchall()
    result = []
    for r in rows:
        result.append({
            "id": str(r[0]),
            "numero_cotizacion": r[1],
            "status": r[2],
            "fecha_envio": r[3].isoformat() if r[3] else None,
            "fecha_respuesta": r[4].isoformat() if r[4] else None,
            "moneda": r[5],
            "plan_code": r[6],
            "plan_title": r[7],
            "plan_id": str(r[8]),
            "lugar_trabajo": r[9],
            "plazo_dias": r[10],
            "created_at": r[11].isoformat() if r[11] else None,
            "gastos_generales_pct": float(r[12]),
            "utilidad_pct": float(r[13]),
            "igv_pct": float(r[14]),
            "contacto_id": str(r[15]) if r[15] else None,
            "contacto_nombre": r[16] or "—",
        })
    return result


def create_contacto_service(cliente_id: str, payload) -> dict:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id FROM clientes WHERE id = %s", (cliente_id,))
            if not cur.fetchone():
                raise HTTPException(404, "Cliente no encontrado")
            cur.execute("""
                INSERT INTO cliente_contactos (cliente_id, nombre, cargo, telefono, email)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id, cliente_id, nombre, cargo, telefono, email
            """, (
                cliente_id,
                payload.nombre.strip(),
                payload.cargo.strip() if payload.cargo else None,
                payload.telefono.strip() if payload.telefono else None,
                payload.email.strip() if payload.email else None
            ))
            row = cur.fetchone()
            conn.commit()
    return {
        "id": str(row[0]),
        "cliente_id": str(row[1]),
        "nombre": row[2],
        "cargo": row[3],
        "telefono": row[4],
        "email": row[5]
    }


def delete_contacto_service(contacto_id: str) -> dict:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM cliente_contactos WHERE id = %s RETURNING id", (contacto_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Contacto no encontrado")
            conn.commit()
    return {"status": "success", "deleted_id": contacto_id}
