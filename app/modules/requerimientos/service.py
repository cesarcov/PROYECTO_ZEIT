import json
from typing import Optional, List, Dict, Any
from app.core.database import db_connection
from .schemas import RequerimientoCreate, RequerimientoUpdate, BulkCostosPayload

def _row_to_requerimiento(r) -> Dict[str, Any]:
    return {
        "id":                  str(r[0]),
        "cliente_id":          str(r[1]),
        "nombre_servicio":     r[2],
        "descripcion":         r[3],
        "fecha_inicio":        r[4].isoformat() if r[4] else None,
        "fecha_fin":           r[5].isoformat() if r[5] else None,
        "estado":              r[6],
        "created_at":          r[7].isoformat() if r[7] else None,
        "updated_at":          r[8].isoformat() if r[8] else None,
        "cliente_razon_social": r[9] if len(r) > 9 else None,
    }

def _row_to_costo(r) -> Dict[str, Any]:
    return {
        "id":               str(r[0]),
        "requerimiento_id": str(r[1]),
        "categoria":        r[2],
        "descripcion":      r[3],
        "costo_unitario":   float(r[4]) if r[4] is not None else 0.0,
        "cantidad":         float(r[5]) if r[5] is not None else 1.0,
        "total":            float(r[6]) if r[6] is not None else 0.0,
        "detalles":         r[7] if isinstance(r[7], dict) else (json.loads(r[7]) if r[7] else {}),
        "created_at":       r[8].isoformat() if r[8] else None,
        "updated_at":       r[9].isoformat() if r[9] else None,
    }

def list_requerimientos_service(cliente_id: Optional[str] = None, estado: Optional[str] = None) -> List[Dict[str, Any]]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            query = """
                SELECT sr.id, sr.cliente_id, sr.nombre_servicio, sr.descripcion,
                       sr.fecha_inicio, sr.fecha_fin, sr.estado, sr.created_at, sr.updated_at,
                       c.razon_social
                FROM servicio_requerimientos sr
                LEFT JOIN clientes c ON c.id = sr.cliente_id
            """
            conditions = []
            params = []
            if cliente_id:
                conditions.append("sr.cliente_id = %s")
                params.append(cliente_id)
            if estado:
                conditions.append("sr.estado = %s")
                params.append(estado)
            
            if conditions:
                query += " WHERE " + " AND ".join(conditions)
            
            query += " ORDER BY sr.fecha_inicio DESC NULLS LAST, sr.created_at DESC"
            cur.execute(query, params)
            return [_row_to_requerimiento(r) for r in cur.fetchall()]

def create_requerimiento_service(data: RequerimientoCreate) -> Dict[str, Any]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO servicio_requerimientos 
                   (cliente_id, nombre_servicio, descripcion, fecha_inicio, fecha_fin, estado)
                   VALUES (%s, %s, %s, %s, %s, %s)
                   RETURNING id, cliente_id, nombre_servicio, descripcion, fecha_inicio, fecha_fin, estado, created_at, updated_at""",
                (data.cliente_id, data.nombre_servicio, data.descripcion, data.fecha_inicio, data.fecha_fin, data.estado)
            )
            row = cur.fetchone()
            conn.commit()
            return _row_to_requerimiento(row)

def update_requerimiento_service(req_id: str, data: RequerimientoUpdate) -> Optional[Dict[str, Any]]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            # Build dynamic UPDATE query
            updates = []
            params = []
            for field, val in data.dict(exclude_unset=True).items():
                updates.append(f"{field} = %s")
                params.append(val)
            
            if not updates:
                return None
                
            params.append(req_id)
            cur.execute(
                f"""UPDATE servicio_requerimientos 
                    SET {", ".join(updates)}, updated_at = NOW()
                    WHERE id = %s
                    RETURNING id, cliente_id, nombre_servicio, descripcion, fecha_inicio, fecha_fin, estado, created_at, updated_at""",
                params
            )
            row = cur.fetchone()
            conn.commit()
            return _row_to_requerimiento(row) if row else None

def delete_requerimiento_service(req_id: str) -> bool:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM servicio_requerimientos WHERE id = %s RETURNING id", (req_id,))
            row = cur.fetchone()
            conn.commit()
            return row is not None

def list_costos_service(req_id: str) -> List[Dict[str, Any]]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, requerimiento_id, categoria, descripcion, costo_unitario, cantidad, total, detalles, created_at, updated_at
                   FROM servicio_requerimiento_costos
                   WHERE requerimiento_id = %s
                   ORDER BY categoria ASC, created_at ASC""",
                (req_id,)
            )
            return [_row_to_costo(r) for r in cur.fetchall()]

def bulk_save_costos_service(req_id: str, payload: BulkCostosPayload) -> Dict[str, int]:
    inserted = 0
    updated = 0
    deleted = 0
    
    with db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Eliminar indicados
            if payload.delete:
                placeholders = ",".join(["%s"] * len(payload.delete))
                cur.execute(
                    f"DELETE FROM servicio_requerimiento_costos WHERE requerimiento_id = %s AND id IN ({placeholders})",
                    [req_id] + payload.delete
                )
                deleted = cur.rowcount
            
            # 2. Upsert indicados
            for item in payload.upsert:
                detalles_json = json.dumps(item.detalles or {})
                if item.id and not str(item.id).startswith("temp-"):
                    # Actualizar
                    cur.execute(
                        """UPDATE servicio_requerimiento_costos 
                           SET categoria = %s, descripcion = %s, costo_unitario = %s, cantidad = %s, detalles = %s, updated_at = NOW()
                           WHERE requerimiento_id = %s AND id = %s""",
                        (item.categoria, item.descripcion, item.costo_unitario, item.cantidad, detalles_json, req_id, item.id)
                    )
                    updated += cur.rowcount
                else:
                    # Insertar nuevo
                    cur.execute(
                        """INSERT INTO servicio_requerimiento_costos 
                           (requerimiento_id, categoria, descripcion, costo_unitario, cantidad, detalles)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (req_id, item.categoria, item.descripcion, item.costo_unitario, item.cantidad, detalles_json)
                    )
                    inserted += 1
            conn.commit()
            
    return {"inserted": inserted, "updated": updated, "deleted": deleted}

def get_requerimientos_kpis_service() -> Dict[str, Any]:
    with db_connection() as conn:
        with conn.cursor() as cur:
            # 1. Totales agrupados por categoría
            cur.execute(
                """SELECT categoria, SUM(total) 
                   FROM servicio_requerimiento_costos
                   GROUP BY categoria
                   ORDER BY SUM(total) DESC"""
            )
            costos_por_categoria = [{"categoria": r[0], "total": float(r[1]) if r[1] is not None else 0.0} for r in cur.fetchall()]
            
            # 2. Totales agrupados por cliente
            cur.execute(
                """SELECT c.razon_social, SUM(src.total)
                   FROM servicio_requerimiento_costos src
                   JOIN servicio_requerimientos sr ON sr.id = src.requerimiento_id
                   JOIN clientes c ON c.id = sr.cliente_id
                   GROUP BY c.razon_social
                   ORDER BY SUM(src.total) DESC"""
            )
            costos_por_cliente = [{"cliente": r[0], "total": float(r[1]) if r[1] is not None else 0.0} for r in cur.fetchall()]
            
            # 3. Lista global consolidada de detalles para reporte
            # Obtenemos todos los registros de costos ordenados por categoría para facilidad de filtrado en el front
            cur.execute(
                """SELECT src.id, src.categoria, src.descripcion, src.costo_unitario, src.cantidad, src.total, src.detalles,
                          sr.nombre_servicio, c.razon_social, sr.id
                   FROM servicio_requerimiento_costos src
                   JOIN servicio_requerimientos sr ON sr.id = src.requerimiento_id
                   JOIN clientes c ON c.id = sr.cliente_id
                   ORDER BY src.categoria ASC, src.created_at DESC"""
            )
            global_costos = []
            for r in cur.fetchall():
                detalles_dict = r[6] if isinstance(r[6], dict) else (json.loads(r[6]) if r[6] else {})
                global_costos.append({
                    "id":               str(r[0]),
                    "categoria":        r[1],
                    "descripcion":      r[2],
                    "costo_unitario":   float(r[3]) if r[3] is not None else 0.0,
                    "cantidad":         float(r[4]) if r[4] is not None else 1.0,
                    "total":            float(r[5]) if r[5] is not None else 0.0,
                    "detalles":         detalles_dict,
                    "nombre_servicio":  r[7],
                    "cliente":          r[8],
                    "requerimiento_id": str(r[9]),
                })
            
            return {
                "por_categoria": costos_por_categoria,
                "por_cliente":   costos_por_cliente,
                "global_costos": global_costos,
            }
