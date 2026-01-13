from uuid import UUID
from typing import Optional, Dict
from fastapi import HTTPException
from app.core.database import db_connection
from app.modules.logistics.schemas import StockMovementCreate, StockLocationCreate,ToolAssignCreate, MaterialCreate
from decimal import Decimal
from app.modules.logistics.utils import read_excel

# ============================================================
# 📦 CALCULAR STOCK TOTAL (KARDEX)
# ============================================================
def get_current_stock(
    material_id: str,
    warehouse_id: str,
    project_id: str | None = None,
) -> float:

    query = """
        SELECT movement_type, quantity, from_warehouse, to_warehouse
        FROM stock_movements
        WHERE material_id = %s
    """

    params = [material_id]

    if project_id:
        query += " AND project_id = %s"
        params.append(project_id)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, tuple(params))
            rows = cur.fetchall()

    stock = 0.0

    for m in rows:
        movement_type = m[0]
        quantity = float(m[1])
        from_wh = m[2]
        to_wh = m[3]

        if movement_type in ("IN", "RETURN") and to_wh == warehouse_id:
            stock += quantity

        elif movement_type == "OUT" and from_wh == warehouse_id:
            stock -= quantity

        elif movement_type == "TRANSFER":
            # 👉 Transferencia interna NO cambia el total del almacén
            # Solo moverá stock entre ubicaciones
            continue

    return stock

# ============================================================
# 📍 STOCK POR UBICACIÓN
# ============================================================
def get_location_stock(material_id, warehouse_id, rack, level, box, position):
    query = """
        SELECT quantity
        FROM stock_locations
        WHERE material_id = %s
          AND warehouse_id = %s
          AND rack = %s
          AND level = %s
          AND box = %s
          AND position = %s
        LIMIT 1;
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (
                str(material_id),   # 🔑 CONVERTIR UUID → STRING
                str(warehouse_id),
                rack,
                level,
                box,
                position
            ))
            row = cur.fetchone()
            return float(row[0]) if row else 0.0


# ============================================================
# ➕ CREAR MOVIMIENTO DE STOCK
# ============================================================
def create_stock_movement_service(payload: StockMovementCreate):

    if payload.movement_type in ("OUT", "ADJUST", "TRANSFER"):
        if not all([payload.rack, payload.level, payload.box, payload.position]):
            raise HTTPException(
                status_code=400,
                detail="Debe indicar rack, level, box y position"
            )

    data = payload.model_dump()
    data["project_id"] = payload.project_id
    for k, v in data.items():
        if isinstance(v, UUID):
            data[k] = str(v)

    data["created_by"] = data.get("created_by") or "system"

    movement_type = data["movement_type"]
    warehouse_id = data.pop("warehouse_id")

    if movement_type == "IN":
        data["from_warehouse"] = None
        data["to_warehouse"] = warehouse_id

    elif movement_type == "OUT":
        data["from_warehouse"] = warehouse_id
        data["to_warehouse"] = None

    elif movement_type == "RETURN":
        data["from_warehouse"] = warehouse_id
        data["to_warehouse"] = warehouse_id

    elif movement_type == "ADJUST":
        if not data.get("notes"):
            raise HTTPException(400, "ADJUST requiere nota")

        current_stock = get_current_stock(
            material_id=data["material_id"],
            warehouse_id=warehouse_id,
            project_id=data.get("project_id"),
        )

        diff = data["quantity"] - current_stock

        if diff == 0:
            raise HTTPException(400, "No hay diferencia de stock")

        if diff > 0:
            data["from_warehouse"] = None
            data["to_warehouse"] = warehouse_id
            data["quantity"] = diff
        else:
            data["from_warehouse"] = warehouse_id
            data["to_warehouse"] = None
            data["quantity"] = abs(diff)

    if movement_type in ("OUT", "ADJUST"):
        current_stock = get_current_stock(
            material_id=data["material_id"],
            warehouse_id=warehouse_id,
            project_id=None,
        )

        if current_stock < data["quantity"]:
            raise HTTPException(400, "Stock insuficiente")

# 🔁 TRANSFER
    if movement_type == "TRANSFER":

        current_stock = get_location_stock(
            material_id=payload.material_id,
            warehouse_id=warehouse_id,
            rack=payload.rack,
            level=payload.level,
            box=payload.box,
            position=payload.position,
        )

        if current_stock < payload.quantity:
            raise HTTPException(400, "Stock insuficiente para transferencia")

        data["from_warehouse"] = warehouse_id
        data["to_warehouse"] = warehouse_id

        for field in ["rack", "level", "box", "position", "to_rack", "to_level", "to_box", "to_position"]:
            data.pop(field, None)

        with db_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO stock_movements (
                        material_id, movement_type, quantity,
                        from_warehouse, to_warehouse, project_id,
                        reference, notes, created_by
                    )
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    RETURNING id, material_id, movement_type, quantity,
                            from_warehouse, to_warehouse, project_id,
                            reference, notes, created_by, created_at;
                """, (
                    data["material_id"],
                    data["movement_type"],
                    data["quantity"],
                    data["from_warehouse"],
                    data["to_warehouse"],
                    data.get("project_id"),
                    data.get("reference"),
                    data.get("notes"),
                    data.get("created_by"),
                ))

                row = cur.fetchone()
                conn.commit()

        # 🔁 MOVER STOCK ENTRE UBICACIONES
        consume_stock_location(
            material_id=payload.material_id,
            warehouse_id=warehouse_id,
            rack=payload.rack,
            level=payload.level,
            box=payload.box,
            position=payload.position,
            quantity=payload.quantity,
        )

        add_stock_location(
            material_id=payload.material_id,
            warehouse_id=warehouse_id,
            rack=payload.to_rack,
            level=payload.to_level,
            box=payload.to_box,
            position=payload.to_position,
            quantity=payload.quantity,
        )

        return {
            "id": str(row[0]),
            "material_id": str(row[1]),
            "movement_type": row[2],
            "quantity": float(row[3]),
            "from_warehouse": str(row[4]) if row[4] else None,
            "to_warehouse": str(row[5]) if row[5] else None,
            "project_id": str(row[6]) if row[6] else None,
            "reference": row[7],
            "notes": row[8],
            "created_by": row[9],
            "created_at": row[10],
        }

    
    for field in ["rack", "level", "box", "position"]:
        data.pop(field, None)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO stock_movements (
                    material_id, movement_type, quantity,
                    from_warehouse, to_warehouse, project_id,
                    reference, notes, created_by
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                RETURNING id;
            """, (
                data["material_id"],
                data["movement_type"],
                data["quantity"],
                data["from_warehouse"],
                data["to_warehouse"],
                data.get("project_id"),
                data.get("reference"),
                data.get("notes"),
                data.get("created_by"),
            ))
            movement_id = cur.fetchone()[0]
            cur.execute("""
                    SELECT id, material_id, movement_type, quantity,
                       from_warehouse, to_warehouse, project_id,
                       reference, notes, created_by, created_at
                    FROM stock_movements
                    WHERE id = %s;
                """, (movement_id,))

            row = cur.fetchone()

            conn.commit()


            return {
                    "id": str(row[0]),
                    "material_id": str(row[1]),
                    "movement_type": row[2],
                    "quantity": float(row[3]),
                    "from_warehouse": str(row[4]) if row[4] else None,
                    "to_warehouse": str(row[5]) if row[5] else None,
                    "project_id": str(row[6]) if row[6] else None,
                    "reference": row[7],
                    "notes": row[8],
                    "created_by": row[9],
                    "created_at": row[10],   # 👈 AQUÍ YA SE DEVUELVE
                }
        
        conn.commit()

    return {"id": str(movement_id), **data}


# ============================================================
# 📜 HISTORIAL
# ============================================================
def get_stock_movements_history(
    date_from: str,
    date_to: str,
    material_id: Optional[str] = None,
    project_id: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    movement_type: Optional[str] = None,
    created_by: Optional[str] = None,
):
    query = """
        SELECT id, material_id, movement_type, quantity,
               from_warehouse, to_warehouse, project_id,
               reference, notes, created_by, created_at
        FROM stock_movements
        WHERE created_at BETWEEN %s AND %s
    """
    params = [f"{date_from} 00:00:00", f"{date_to} 23:59:59"]

    if material_id:
        query += " AND material_id = %s"
        params.append(material_id)
    if project_id:
        query += " AND project_id = %s"
        params.append(project_id)
    if warehouse_id:
        query += " AND (from_warehouse = %s OR to_warehouse = %s)"
        params.extend([warehouse_id, warehouse_id])
    if movement_type:
        query += " AND movement_type = %s"
        params.append(movement_type)
    if created_by:
        query += " AND created_by = %s"
        params.append(created_by)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return rows


# ============================================================
# 📊 RESUMEN
# ============================================================
def get_current_stock_summary(material_id: Optional[str] = None) -> Dict:
    query = "SELECT material_id, movement_type, quantity, from_warehouse, to_warehouse FROM stock_movements"
    params = []

    if material_id:
        query += " WHERE material_id = %s"
        params.append(material_id)

    stock: Dict[str, Dict[str, float]] = {}

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    for mat, m_type, qty, from_wh, to_wh in rows:
        stock.setdefault(mat, {})

        def add(wh, amount):
            if not wh:
                return
            stock[mat][wh] = stock[mat].get(wh, 0) + amount

        if m_type in ("IN", "RETURN"):
            add(to_wh, qty)
        elif m_type == "OUT":
            add(from_wh, -qty)
        elif m_type == "TRANSFER":
            add(from_wh, -qty)
            add(to_wh, qty)

    return stock


# ============================================================
# 🚨 STOCK NEGATIVO
# ============================================================
def get_negative_stock():
    stock = get_current_stock_summary()
    alerts = []

    for material, warehouses in stock.items():
        for wh, qty in warehouses.items():
            if qty < 0:
                alerts.append({
                    "material_id": material,
                    "warehouse_id": wh,
                    "quantity": qty,
                    "alert": "NEGATIVE_STOCK"
                })

    return alerts


# ============================================================
# 📍 UBICACIONES
# ============================================================
def upsert_stock_location(payload: StockLocationCreate):
    data = payload.model_dump()

    # 🔁 Convertir UUIDs a string (psycopg2 no acepta UUID directamente)
    for k, v in data.items():
        if isinstance(v, UUID):
            data[k] = str(v)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO stock_locations (
                    material_id, warehouse_id, rack, level, box, position, quantity
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (material_id, warehouse_id, rack, level, box, position)
                DO UPDATE SET
                    quantity = EXCLUDED.quantity,
                    updated_at = NOW()
                RETURNING id, material_id, warehouse_id, rack, level, box, position,
                          quantity, created_at, updated_at;
                """,
                (
                    data["material_id"],
                    data["warehouse_id"],
                    data["rack"],
                    data["level"],
                    data["box"],
                    data["position"],
                    data["quantity"],
                )
            )

            row = cur.fetchone()
            conn.commit()

    return {
        "id": row[0],
        "material_id": row[1],
        "warehouse_id": row[2],
        "rack": row[3],
        "level": row[4],
        "box": row[5],
        "position": row[6],
        "quantity": float(row[7]),
        "created_at": row[8],
        "updated_at": row[9],
    }



def get_material_locations(material_id: str, warehouse_id: Optional[str] = None):
    query = """
        SELECT material_id, warehouse_id, rack, level, box, position, quantity
        FROM stock_locations
        WHERE material_id = %s
    """
    params = [material_id]

    if warehouse_id:
        query += " AND warehouse_id = %s"
        params.append(warehouse_id)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()

    return rows


def consume_stock_location(
    material_id, warehouse_id, rack, level, box, position, quantity
):
    # 🔁 Convertir UUIDs a string para psycopg2
    if isinstance(material_id, UUID):
        material_id = str(material_id)
    if isinstance(warehouse_id, UUID):
        warehouse_id = str(warehouse_id)

    with db_connection() as conn:
        with conn.cursor() as cur:
            # 🔎 Buscar ubicación exacta
            cur.execute("""
                SELECT id, quantity FROM stock_locations
                WHERE material_id=%s AND warehouse_id=%s
                  AND rack=%s AND level=%s AND box=%s AND position=%s
            """, (material_id, warehouse_id, rack, level, box, position))

            row = cur.fetchone()

            if not row:
                raise ValueError("No existe stock en la ubicación indicada")

            location_id, current_qty = row

            if current_qty < quantity:
                raise ValueError("Stock insuficiente en la ubicación indicada")

            # ➖ Descontar cantidad
            cur.execute("""
                UPDATE stock_locations
                SET quantity = quantity - %s,
                    updated_at = NOW()
                WHERE id = %s
            """, (quantity, location_id))

        conn.commit()


def add_stock_location(
    material_id, warehouse_id, rack, level, box, position, quantity
):
    # 🔁 Convertir UUIDs a string para psycopg2
    if isinstance(material_id, UUID):
        material_id = str(material_id)
    if isinstance(warehouse_id, UUID):
        warehouse_id = str(warehouse_id)

    with db_connection() as conn:
        with conn.cursor() as cur:
            # 🔎 Verificar si ya existe esa ubicación
            cur.execute("""
                SELECT id, quantity FROM stock_locations
                WHERE material_id=%s AND warehouse_id=%s
                  AND rack=%s AND level=%s AND box=%s AND position=%s
            """, (material_id, warehouse_id, rack, level, box, position))

            row = cur.fetchone()

            if row:
                location_id, current_qty = row

                # ➕ Sumar cantidad existente
                cur.execute("""
                    UPDATE stock_locations
                    SET quantity = quantity + %s,
                        updated_at = NOW()
                    WHERE id = %s
                """, (quantity, location_id))
            else:
                # 🆕 Crear nueva ubicación
                cur.execute("""
                    INSERT INTO stock_locations (
                        material_id, warehouse_id, rack, level, box, position, quantity
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                """, (material_id, warehouse_id, rack, level, box, position, quantity))

        conn.commit()


def get_stock_by_project(project_id: str | None = None):
    base_query = """
        SELECT 
            project_id,
            material_id,
            SUM(
                CASE
                    WHEN movement_type = 'OUT' THEN quantity
                    WHEN movement_type = 'RETURN' THEN -quantity
                    ELSE 0
                END
            ) AS used_quantity
        FROM stock_movements
        WHERE project_id IS NOT NULL
    """

    params = []

    if project_id:
        base_query += " AND project_id = %s"
        params.append(project_id)

    base_query += " GROUP BY project_id, material_id;"

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(base_query, params)
            rows = cur.fetchall()

    result = []
    for r in rows:
        result.append({
            "project_id": str(r[0]),
            "material_id": str(r[1]),
            "used_quantity": float(r[2])
        })

    return result

def get_low_stock_alerts():
    query = """
        SELECT 
            m.id AS material_id,
            COALESCE(SUM(
                CASE 
                    WHEN sm.movement_type IN ('IN','RETURN') THEN sm.quantity
                    WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                    ELSE 0
                END
            ), 0) AS current_stock,
            m.min_stock
        FROM materials m
        LEFT JOIN stock_movements sm ON sm.material_id = m.id
        GROUP BY m.id, m.min_stock
        HAVING COALESCE(SUM(
                CASE 
                    WHEN sm.movement_type IN ('IN','RETURN') THEN sm.quantity
                    WHEN sm.movement_type = 'OUT' THEN -sm.quantity
                    ELSE 0
                END
            ), 0) <= m.min_stock;
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

    alerts = []
    for material_id, current_stock, min_stock in rows:
        alerts.append({
            "material_id": str(material_id),
            "current_stock": float(current_stock),
            "min_stock": float(min_stock),
            "alert": "LOW_STOCK"
        })

    return alerts

def get_most_used_materials(limit: int = 10):
    query = """
        SELECT 
            material_id,
            SUM(quantity) AS total_used
        FROM stock_movements
        WHERE movement_type = 'OUT'
        GROUP BY material_id
        ORDER BY total_used DESC
        LIMIT %s;
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (limit,))
            rows = cur.fetchall()

    return [
        {
            "material_id": str(material_id),
            "total_used": float(total_used)
        }
        for material_id, total_used in rows
    ]

def assign_tool_service(payload: ToolAssignCreate):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tool_assignments (
                    material_id, project_id, assigned_to, expected_return
                )
                VALUES (%s,%s,%s,%s)
                RETURNING id, material_id, project_id, assigned_to,
                          assigned_at, expected_return, status;
            """, (
                str(payload.material_id),
                str(payload.project_id),
                payload.assigned_to,
                payload.expected_return
            ))

            row = cur.fetchone()
            conn.commit()

    return {
        "id": str(row[0]),
        "material_id": str(row[1]),
        "project_id": str(row[2]),
        "assigned_to": row[3],
        "assigned_at": row[4],
        "expected_return": row[5],
        "status": row[6],
    }

# ============================================================
# 🔁 DEVOLVER HERRAMIENTA
# ============================================================
def return_tool_service(assignment_id: str):
    with db_connection() as conn:
        with conn.cursor() as cur:
            # 1️⃣ Buscar asignación activa
            cur.execute("""
                SELECT id, material_id, project_id, assigned_to, assigned_at,
                       expected_return, status
                FROM tool_assignments
                WHERE id = %s AND status = 'IN_USE';
            """, (assignment_id,))

            row = cur.fetchone()

            if not row:
                raise HTTPException(
                    status_code=404,
                    detail="Asignación no encontrada o ya devuelta"
                )

            # 2️⃣ Marcar como devuelta
            cur.execute("""
                UPDATE tool_assignments
                SET status = 'RETURNED',
                    returned_at = NOW()
                WHERE id = %s;
            """, (assignment_id,))

            conn.commit()

    return {
        "assignment_id": assignment_id,
        "status": "RETURNED",
        "message": "Herramienta devuelta correctamente"
    }

def get_assigned_tools_service():
    query = """
        SELECT id, material_id, project_id, assigned_to,
               assigned_at, expected_return, status
        FROM tool_assignments
        WHERE status = 'IN_USE';
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "material_id": str(r[1]),
            "project_id": str(r[2]),
            "assigned_to": r[3],
            "assigned_at": r[4],
            "expected_return": r[5],
            "status": r[6],
        }
        for r in rows
    ]

def register_tool_maintenance(material_id, maintenance_type, last_maintenance, next_due, notes=None):

    # 🔑 Convertir UUID a string si viene como objeto UUID
    if isinstance(material_id, UUID):
        material_id = str(material_id)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO tool_maintenance (
                    material_id, maintenance_type, last_maintenance, next_due, notes
                ) VALUES (%s,%s,%s,%s,%s)
                RETURNING id;
            """, (material_id, maintenance_type, last_maintenance, next_due, notes))
            maintenance_id = cur.fetchone()[0]
            conn.commit()

    return {"id": str(maintenance_id)}

def get_due_maintenance():
    query = """
        SELECT id, material_id, maintenance_type, next_due
        FROM tool_maintenance
        WHERE next_due <= CURRENT_DATE;
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query)
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "material_id": str(r[1]),
            "maintenance_type": r[2],
            "next_due": r[3],
            "alert": "MAINTENANCE_DUE"
        }
        for r in rows
    ]

def get_tool_maintenance_alerts(days_ahead: int = 7):
    query = """
        SELECT 
            tm.id,
            tm.material_id,
            tm.maintenance_type,
            tm.last_maintenance,
            tm.next_due,
            tm.notes
        FROM tool_maintenance tm
        WHERE tm.next_due <= CURRENT_DATE + INTERVAL '%s days'
        ORDER BY tm.next_due ASC;
    """

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(query, (days_ahead,))
            rows = cur.fetchall()

    alerts = []
    for r in rows:
        alerts.append({
            "id": str(r[0]),
            "material_id": str(r[1]),
            "maintenance_type": r[2],
            "last_maintenance": r[3],
            "next_due": r[4],
            "notes": r[5],
            "alert": "MAINTENANCE_DUE"
        })

    return alerts

# ============================================================
# 📦 CREAR MATERIAL
# ============================================================
def create_material_service(payload: MaterialCreate):
    data = payload.model_dump()

    if data.get("aliases") and len(data["aliases"]) > 3:
        raise HTTPException(400, "Máximo 3 nombres alternativos por material")

    with db_connection() as conn:
        with conn.cursor() as cur:

            # Verificar código duplicado
            cur.execute("SELECT id FROM materials WHERE code = %s;", (data["code"],))
            if cur.fetchone():
                raise HTTPException(400, "Ya existe un material con ese código")

            # Insertar material
            cur.execute("""
                INSERT INTO materials (name, code, min_stock, category)
                VALUES (%s, %s, %s, %s)
                RETURNING id, name, code, min_stock, category, created_at;
            """, (
                data["name"],
                data["code"],
                data["min_stock"],
                data["category"]
            ))

            row = cur.fetchone()
            material_id = row[0]

            # Insertar alias
            aliases = data.get("aliases", [])
            for alias in aliases:
                cur.execute("""
                    INSERT INTO material_aliases (material_id, alias_name)
                    VALUES (%s, %s);
                """, (material_id, alias))

            conn.commit()

    return {
        "id": row[0],
        "name": row[1],
        "code": row[2],
        "min_stock": float(row[3]),
        "category": row[4],
        "aliases": aliases,
        "created_at": row[5],
    }


# ============================================================
# 📋 LISTAR MATERIALES
# ============================================================
def get_materials_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    m.id, m.name, m.code, m.min_stock, m.category, m.created_at,
                    COALESCE(array_agg(a.alias_name) FILTER (WHERE a.alias_name IS NOT NULL), '{}') AS aliases
                FROM materials m
                LEFT JOIN material_aliases a ON a.material_id = m.id
                GROUP BY m.id
                ORDER BY m.name;
            """)
            rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "name": r[1],
            "code": r[2],
            "min_stock": float(r[3]),
            "category": r[4],
            "created_at": r[5],
            "aliases": list(r[6]),
        }
        for r in rows
    ]

# ============================================================
# 📦 A) Importar Materiales
# ============================================================

def import_materials_from_excel(file):
    df = read_excel(file)

    required_cols = ["name", "code", "category", "min_stock"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Falta la columna: {col}")

    inserted = 0
    updated = 0

    with db_connection() as conn:
        with conn.cursor() as cur:
            for _, row in df.iterrows():
                cur.execute("""
                    SELECT id FROM materials WHERE code = %s
                """, (row["code"],))
                existing = cur.fetchone()

                if existing:
                    cur.execute("""
                        UPDATE materials
                        SET name=%s, category=%s, min_stock=%s,
                            alias1=%s, alias2=%s, alias3=%s
                        WHERE code=%s
                    """, (
                        row["name"],
                        row["category"],
                        row["min_stock"],
                        row.get("alias1"),
                        row.get("alias2"),
                        row.get("alias3"),
                        row["code"],
                    ))
                    updated += 1
                else:
                    cur.execute("""
                        INSERT INTO materials (name, code, category, min_stock, alias1, alias2, alias3)
                        VALUES (%s,%s,%s,%s,%s,%s,%s)
                    """, (
                        row["name"],
                        row["code"],
                        row["category"],
                        row["min_stock"],
                        row.get("alias1"),
                        row.get("alias2"),
                        row.get("alias3"),
                    ))
                    inserted += 1

        conn.commit()

    return {
        "inserted": inserted,
        "updated": updated,
        "total": inserted + updated
    }

# ============================================================
#  📥 B) Importar Stock IN (Ingreso)
# ============================================================

def import_stock_in_from_excel(file):
    df = read_excel(file)

    # NOTA: usamos warehouse_code (código humano), no UUID
    required_cols = ["material_code", "warehouse_id", "quantity"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Falta la columna: {col}")

    inserted = 0
    failed = 0
    errors = []

    with db_connection() as conn:
        with conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    # 1️⃣ Validar material por código
                    if not row.get("material_code"):
                        raise ValueError("Fila sin material_code")

                    cur.execute(
                        "SELECT id FROM materials WHERE code=%s;",
                        (row["material_code"],)
                    )
                    mat = cur.fetchone()
                    if not mat:
                        raise ValueError(f"Material no existe: {row['material_code']}")

                    material_id = mat[0]

                    # 2️⃣ Validar almacén por CÓDIGO (WH-CENTRAL, etc.)
                    if not row.get("warehouse_id"):
                        raise ValueError("Fila sin warehouse_id (código)")

                    cur.execute(
                        "SELECT id FROM warehouses WHERE code=%s;",
                        (row["warehouse_id"],)
                    )
                    wh = cur.fetchone()
                    if not wh:
                        raise ValueError(f"Almacén no existe: {row['warehouse_id']}")

                    warehouse_id = wh[0]

                    # 3️⃣ Insertar movimiento IN usando SOLO UUIDs
                    cur.execute("""
                        INSERT INTO stock_movements (
                            material_id, movement_type, quantity,
                            from_warehouse, to_warehouse,
                            reference, notes, created_by
                        )
                        VALUES (%s,'IN',%s,NULL,%s,%s,%s,'excel');
                    """, (
                        str(material_id),
                        float(row["quantity"]),
                        str(warehouse_id),
                        row.get("reference"),
                        row.get("notes"),
                    ))

                    inserted += 1

                except Exception as e:
                    failed += 1
                    errors.append({
                        "row": int(idx) + 2,  # +2 por encabezado y base 0
                        "material_code": row.get("material_code"),
                        "warehouse_id": row.get("warehouse_id"),
                        "error": str(e)
                    })
                    # Continúa con la siguiente fila
                    continue

        conn.commit()

    return {
        "status": "OK",
        "inserted": inserted,
        "failed": failed,
        "total": inserted + failed,
        "errors": errors
    }


# ============================================================
#  📤 C) Importar Stock OUT por Proyecto
# ============================================================

def import_stock_out_from_excel(file):
    df = read_excel(file)

    # NOTA: warehouse_id y project_id vienen como CÓDIGOS, no UUID
    required_cols = ["material_code", "warehouse_id", "project_id", "quantity"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Falta la columna: {col}")

    inserted = 0
    failed = 0
    errors = []

    with db_connection() as conn:
        with conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    # 1️⃣ Validar material por código
                    if not row.get("material_code"):
                        raise ValueError("Fila sin material_code")

                    cur.execute(
                        "SELECT id FROM materials WHERE code=%s;",
                        (row["material_code"],)
                    )
                    mat = cur.fetchone()
                    if not mat:
                        raise ValueError(f"Material no existe: {row['material_code']}")

                    material_id = mat[0]

                    # 2️⃣ Validar almacén por CÓDIGO
                    if not row.get("warehouse_id"):
                        raise ValueError("Fila sin warehouse_id (código)")

                    cur.execute(
                        "SELECT id FROM warehouses WHERE code=%s;",
                        (row["warehouse_id"],)
                    )
                    wh = cur.fetchone()
                    if not wh:
                        raise ValueError(f"Almacén no existe: {row['warehouse_id']}")

                    warehouse_id = wh[0]

                    # 3️⃣ Validar proyecto por CÓDIGO
                    if not row.get("project_id"):
                        raise ValueError("Fila sin project_id (código)")

                    cur.execute(
                        "SELECT id FROM projects WHERE code=%s;",
                        (row["project_id"],)
                    )
                    pr = cur.fetchone()
                    if not pr:
                        raise ValueError(f"Proyecto no existe: {row['project_id']}")

                    project_id = pr[0]

                    # 4️⃣ Insertar movimiento OUT usando SOLO UUIDs
                    cur.execute("""
                        INSERT INTO stock_movements (
                            material_id, movement_type, quantity,
                            from_warehouse, to_warehouse, project_id,
                            reference, notes, created_by
                        )
                        VALUES (%s,'OUT',%s,%s,NULL,%s,%s,%s,'excel');
                    """, (
                        str(material_id),
                        float(row["quantity"]),
                        str(warehouse_id),
                        str(project_id),
                        row.get("reference"),
                        row.get("notes"),
                    ))

                    inserted += 1

                except Exception as e:
                    failed += 1
                    errors.append({
                        "row": int(idx) + 2,  # +2 por encabezado y base 0
                        "material_code": row.get("material_code"),
                        "warehouse_id": row.get("warehouse_id"),
                        "project_id": row.get("project_id"),
                        "error": str(e)
                    })
                    continue

        conn.commit()

    return {
        "status": "OK",
        "inserted": inserted,
        "failed": failed,
        "total": inserted + failed,
        "errors": errors
    }


# ============================================================
# 🧹 RESET DE DATOS (SOLO PARA TESTING)
# ============================================================

def reset_logistics_data_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            # Movimientos y ubicaciones
            cur.execute("TRUNCATE TABLE stock_movements RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE stock_locations RESTART IDENTITY CASCADE;")

            # Herramientas
            cur.execute("TRUNCATE TABLE tool_assignments RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE tool_maintenance RESTART IDENTITY CASCADE;")

            # Materiales
            cur.execute("TRUNCATE TABLE material_aliases RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE materials RESTART IDENTITY CASCADE;")

            # Proyectos y almacenes
            cur.execute("TRUNCATE TABLE projects RESTART IDENTITY CASCADE;")
            cur.execute("TRUNCATE TABLE warehouses RESTART IDENTITY CASCADE;")

            conn.commit()

    return {
        "status": "OK",
        "message": "Todos los datos de logística fueron eliminados (tablas conservadas)."
    }

# ============================================================
# 🏬 WAREHOUSES
# ============================================================

def create_warehouse_service(payload):
    data = payload.model_dump()

    with db_connection() as conn:
        with conn.cursor() as cur:
            # Evitar códigos duplicados
            cur.execute("SELECT id FROM warehouses WHERE code = %s;", (data["code"],))
            if cur.fetchone():
                raise HTTPException(400, "Ya existe un almacén con ese código")

            cur.execute("""
                INSERT INTO warehouses (code, name, location)
                VALUES (%s, %s, %s)
                RETURNING id, code, name, location;
            """, (
                data["code"],
                data["name"],
                data.get("location"),
            ))

            row = cur.fetchone()
            conn.commit()

    return {
        "id": str(row[0]),
        "code": row[1],
        "name": row[2],
        "location": row[3],
    }


def get_warehouses_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, code, name, location FROM warehouses ORDER BY code;")
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "code": r[1],
            "name": r[2],
            "location": r[3],
        }
        for r in rows
    ]

# ============================================================
# 🏗 PROJECTS
# ============================================================

def create_project_service(payload):
    data = payload.model_dump()

    with db_connection() as conn:
        with conn.cursor() as cur:
            # Evitar códigos duplicados
            cur.execute("SELECT id FROM projects WHERE code = %s;", (data["code"],))
            if cur.fetchone():
                raise HTTPException(400, "Ya existe un proyecto con ese código")

            cur.execute("""
                INSERT INTO projects (code, name)
                VALUES (%s, %s)
                RETURNING id, code, name;
            """, (
                data["code"],
                data["name"],
            ))

            row = cur.fetchone()
            conn.commit()

    return {
        "id": str(row[0]),
        "code": row[1],
        "name": row[2],
    }


def get_projects_service():
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT id, code, name FROM projects ORDER BY code;")
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "code": r[1],
            "name": r[2],
        }
        for r in rows
    ]

# ============================================================
# 📥 IMPORTAR WAREHOUSES (EXCEL)
# ============================================================

def import_warehouses_from_excel(file):
    df = read_excel(file)

    required_cols = ["code", "name", "location"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Falta la columna: {col}")

    inserted = 0
    updated = 0
    failed = 0
    errors = []

    with db_connection() as conn:
        with conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    if not row.get("code"):
                        raise ValueError("Fila sin code")

                    cur.execute("SELECT id FROM warehouses WHERE code = %s;", (row["code"],))
                    existing = cur.fetchone()

                    if existing:
                        cur.execute("""
                            UPDATE warehouses
                            SET name = %s,
                                location = %s
                            WHERE code = %s;
                        """, (
                            row["name"],
                            row.get("location"),
                            row["code"],
                        ))
                        updated += 1
                    else:
                        cur.execute("""
                            INSERT INTO warehouses (code, name, location)
                            VALUES (%s, %s, %s);
                        """, (
                            row["code"],
                            row["name"],
                            row.get("location"),
                        ))
                        inserted += 1

                except Exception as e:
                    failed += 1
                    errors.append({
                        "row": int(idx) + 2,
                        "code": row.get("code"),
                        "error": str(e)
                    })
                    continue

        conn.commit()

    return {
        "status": "OK",
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "total": inserted + updated + failed,
        "errors": errors
    }


# ============================================================
# 📥 IMPORTAR PROJECTS (EXCEL)
# ============================================================

def import_projects_from_excel(file):
    df = read_excel(file)

    required_cols = ["code", "name"]
    for col in required_cols:
        if col not in df.columns:
            raise ValueError(f"Falta la columna: {col}")

    inserted = 0
    updated = 0
    failed = 0
    errors = []

    with db_connection() as conn:
        with conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    if not row.get("code"):
                        raise ValueError("Fila sin code")

                    cur.execute("SELECT id FROM projects WHERE code = %s;", (row["code"],))
                    existing = cur.fetchone()

                    if existing:
                        cur.execute("""
                            UPDATE projects
                            SET name = %s
                            WHERE code = %s;
                        """, (
                            row["name"],
                            row["code"],
                        ))
                        updated += 1
                    else:
                        cur.execute("""
                            INSERT INTO projects (code, name)
                            VALUES (%s, %s);
                        """, (
                            row["code"],
                            row["name"],
                        ))
                        inserted += 1

                except Exception as e:
                    failed += 1
                    errors.append({
                        "row": int(idx) + 2,
                        "code": row.get("code"),
                        "error": str(e)
                    })
                    continue

        conn.commit()

    return {
        "status": "OK",
        "inserted": inserted,
        "updated": updated,
        "failed": failed,
        "total": inserted + updated + failed,
        "errors": errors
    }
