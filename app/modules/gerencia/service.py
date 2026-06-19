from fastapi import HTTPException
from app.core.database import db_connection
from app.modules.gerencia.schemas import AprobacionDecidir

def list_aprobaciones_service(estado: str = None):
    with db_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT 
                    a.id,
                    a.tipo,
                    a.referencia_id,
                    a.titulo,
                    a.descripcion,
                    a.monto,
                    a.estado,
                    a.solicitado_por,
                    u.username AS solicitante_username,
                    a.notas_gerencia,
                    a.created_at,
                    a.updated_at
                FROM aprobaciones_gerencia a
                JOIN users u ON a.solicitado_por = u.id
            """
            params = []
            if estado:
                query += " WHERE a.estado = %s"
                params.append(estado)
            query += " ORDER BY a.created_at DESC"
            
            cur.execute(query, tuple(params))
            rows = cur.fetchall()
            
            aprobaciones = []
            for r in rows:
                ap_id = str(r[0])
                tipo = r[1]
                ref_id = str(r[2])
                
                detalles = {}
                # Obtener detalles del objeto referenciado para inspección gerencial
                if tipo == 'VISITA_TECNICA':
                    cur.execute("""
                        SELECT vt.fecha_visita, vt.destino, vt.motivo, vt.costo_estimado, p.title
                        FROM visitas_tecnicas vt
                        JOIN project_plans p ON vt.plan_id = p.id
                        WHERE vt.id = %s
                    """, (ref_id,))
                    vt_row = cur.fetchone()
                    if vt_row:
                        detalles = {
                            "fecha_visita": str(vt_row[0]) if vt_row[0] else None,
                            "destino": vt_row[1],
                            "motivo": vt_row[2],
                            "costo_estimado": float(vt_row[3]),
                            "proyecto": vt_row[4]
                        }
                elif tipo == 'COTIZACION':
                    cur.execute("""
                        SELECT pc.numero_cotizacion, pc.cliente_nombre, pc.moneda, pc.plazo_dias, pc.validez_dias, pc.plan_id, p.title
                        FROM presupuesto_config pc
                        JOIN project_plans p ON pc.plan_id = p.id
                        WHERE pc.id = %s
                    """, (ref_id,))
                    pc_row = cur.fetchone()
                    if pc_row:
                        detalles = {
                            "numero_cotizacion": pc_row[0],
                            "cliente_nombre": pc_row[1],
                            "moneda": pc_row[2],
                            "plazo_dias": pc_row[3],
                            "validez_dias": pc_row[4],
                            "plan_id": str(pc_row[5]),
                            "proyecto": pc_row[6]
                        }
                        # Contar partidas
                        cur.execute("SELECT COUNT(*) FROM presupuesto_partidas WHERE plan_id = %s;", (pc_row[5],))
                        detalles["partidas_count"] = cur.fetchone()[0]
                elif tipo == 'PRESTAMO_COMPRA':
                    cur.execute("""
                        SELECT oc.code, pr.nombre, wh.name, oc.total_estimado, oc.notas
                        FROM ordenes_compra oc
                        JOIN proveedores pr ON oc.proveedor_id = pr.id
                        JOIN warehouses wh ON oc.almacen_destino = wh.id
                        WHERE oc.id = %s
                    """, (ref_id,))
                    oc_row = cur.fetchone()
                    if oc_row:
                        detalles = {
                            "code": oc_row[0],
                            "proveedor": oc_row[1],
                            "almacen": oc_row[2],
                            "total_estimado": float(oc_row[3]) if oc_row[3] is not None else None,
                            "notas": oc_row[4],
                            "items": []
                        }
                        # Traer ítems de la orden de compra
                        cur.execute("""
                            SELECT m.name, oci.cantidad_pedida, oci.precio_unitario, oci.notas
                            FROM ordenes_compra_items oci
                            JOIN materials m ON oci.material_id = m.id
                            WHERE oci.oc_id = %s
                        """, (ref_id,))
                        item_rows = cur.fetchall()
                        detalles["items"] = [
                            {
                                "material": item[0],
                                "cantidad": float(item[1]),
                                "precio_unitario": float(item[2]),
                                "notas": item[3]
                            }
                            for item in item_rows
                        ]
                
                aprobaciones.append({
                    "id": ap_id,
                    "tipo": tipo,
                    "referencia_id": ref_id,
                    "titulo": r[3],
                    "descripcion": r[4],
                    "monto": float(r[5]) if r[5] is not None else None,
                    "estado": r[6],
                    "solicitado_por": str(r[7]),
                    "solicitante_username": r[8],
                    "notas_gerencia": r[9],
                    "created_at": r[10],
                    "updated_at": r[11],
                    "detalles": detalles
                })
            return aprobaciones

def decidir_aprobacion_service(aprobacion_id: str, payload: AprobacionDecidir, current_user):
    is_gerente = current_user.get("primary_module") == "gerente" or "admin" in current_user.get("permissions", [])
    if not is_gerente:
        raise HTTPException(status_code=403, detail="No tienes permisos de Gerencia para realizar esta acción.")

    decision = payload.decision
    if decision not in ("APROBADO", "RECHAZADO"):
        raise HTTPException(status_code=400, detail="Decisión no válida. Debe ser 'APROBADO' o 'RECHAZADO'.")

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT tipo, referencia_id, estado 
                FROM aprobaciones_gerencia 
                WHERE id = %s
            """, (aprobacion_id,))
            row = cur.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Aprobación no encontrada.")

            tipo, referencia_id, estado_actual = row
            if estado_actual != "PENDIENTE":
                raise HTTPException(status_code=400, detail=f"Esta aprobación ya se encuentra en estado '{estado_actual}'.")

            try:
                cur.execute("""
                    UPDATE aprobaciones_gerencia
                    SET estado = %s,
                        notas_gerencia = %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (decision, payload.notas_gerencia, aprobacion_id))

                if tipo == "VISITA_TECNICA":
                    estado_visita = "APROBADA" if decision == "APROBADO" else "RECHAZADA"
                    cur.execute("""
                        UPDATE visitas_tecnicas
                        SET estado = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (estado_visita, referencia_id))

                elif tipo == "COTIZACION":
                    estado_cot = "APROBADA" if decision == "APROBADO" else "RECHAZADA"
                    cur.execute("""
                        UPDATE presupuesto_config
                        SET status = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (estado_cot, referencia_id))

                elif tipo == "PRESTAMO_COMPRA":
                    estado_oc = "APROBADA" if decision == "APROBADO" else "CANCELADA"
                    cur.execute("""
                        UPDATE ordenes_compra
                        SET status = %s,
                            aprobado_por = %s,
                            updated_at = NOW()
                        WHERE id = %s
                    """, (estado_oc, current_user["id"], referencia_id))

                conn.commit()
                return {"message": "Aprobación procesada correctamente", "id": aprobacion_id, "estado": decision}

            except Exception as e:
                conn.rollback()
                raise HTTPException(status_code=500, detail=f"Error al procesar la aprobación: {str(e)}")
