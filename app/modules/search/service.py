from app.core.database import db_connection

def has_permission(user: dict, permission: str) -> bool:
    perms = user.get("permissions", [])
    if "superadmin:*" in perms:
        return True
    return permission in perms

def global_search_service(query: str, user: dict) -> list:
    if not query or len(query.strip()) < 2:
        return []

    q = f"%{query.strip()}%"
    results = []
    user_id = str(user["id"])
    
    # Comprobar si es staff (admin, logística, supervisor)
    is_staff = (
        has_permission(user, "admin:users") or 
        has_permission(user, "logistics:stock:view") or 
        has_permission(user, "logistics:projects:manage") or
        user.get("role") == "superadmin"
    )

    with db_connection() as conn:
        with conn.cursor() as cur:
            # 1. MATERIALES (Requiere logistics:materials:view)
            if has_permission(user, "logistics:materials:view") or user.get("role") == "superadmin":
                cur.execute("""
                    SELECT id, code, name, category
                    FROM materials
                    WHERE (name ILIKE %s OR code ILIKE %s OR category ILIKE %s) AND estado = 'ACTIVO'
                    LIMIT 5
                """, (q, q, q))
                for row in cur.fetchall():
                    results.append({
                        "category": "Materiales",
                        "title": row[2],
                        "subtitle": f"Código: {row[1]} | Categoría: {row[3]}",
                        "link": f"/materials?search={row[1]}"
                    })

            # 2. PROYECTOS / PLANES
            # Si es staff, puede ver todos los planes. Si no, solo los suyos.
            if is_staff:
                cur.execute("""
                    SELECT pp.id, pp.title, pp.project_code, u.username
                    FROM project_plans pp
                    LEFT JOIN users u ON u.id = pp.engineer_id
                    WHERE pp.title ILIKE %s OR pp.project_code ILIKE %s OR pp.custom_project_name ILIKE %s
                    LIMIT 5
                """, (q, q, q))
            else:
                cur.execute("""
                    SELECT pp.id, pp.title, pp.project_code, u.username
                    FROM project_plans pp
                    LEFT JOIN users u ON u.id = pp.engineer_id
                    WHERE pp.engineer_id = %s AND (pp.title ILIKE %s OR pp.project_code ILIKE %s OR pp.custom_project_name ILIKE %s)
                    LIMIT 5
                """, (user_id, q, q, q))
            for row in cur.fetchall():
                results.append({
                    "category": "Proyectos / Planes",
                    "title": row[1],
                    "subtitle": f"Código: {row[2] or '—'} | Creador: {row[3] or '—'}",
                    "link": f"/operations/plans?id={row[0]}"
                })

            # 3. ÓRDENES DE TRABAJO (OTs)
            # Si es staff, puede ver todas las OTs. Si no, solo las que creó o tiene asignadas.
            if is_staff:
                cur.execute("""
                    SELECT ot.id, ot.code, ot.titulo, ot.status
                    FROM ordenes_trabajo ot
                    WHERE ot.titulo ILIKE %s OR ot.code ILIKE %s OR ot.descripcion ILIKE %s
                    LIMIT 5
                """, (q, q, q))
            else:
                cur.execute("""
                    SELECT ot.id, ot.code, ot.titulo, ot.status
                    FROM ordenes_trabajo ot
                    WHERE (ot.creado_por = %s OR ot.asignado_a = %s) AND (ot.titulo ILIKE %s OR ot.code ILIKE %s OR ot.descripcion ILIKE %s)
                    LIMIT 5
                """, (user_id, user_id, q, q, q))
            for row in cur.fetchall():
                results.append({
                    "category": "Órdenes de Trabajo (OT)",
                    "title": f"OT {row[1]}: {row[2]}",
                    "subtitle": f"Estado: {row[3]}",
                    "link": f"/operaciones/ot?code={row[1]}"
                })

            # 4. ÓRDENES DE COMPRA (OCs)
            # Requiere logistics:stock:view o logistics:stock:receive o ser superadmin
            if has_permission(user, "logistics:stock:view") or has_permission(user, "logistics:stock:receive") or user.get("role") == "superadmin":
                cur.execute("""
                    SELECT oc.id, oc.code, p.nombre, oc.status
                    FROM ordenes_compra oc
                    JOIN proveedores p ON p.id = oc.proveedor_id
                    WHERE oc.code ILIKE %s OR oc.notas ILIKE %s OR p.nombre ILIKE %s
                    LIMIT 5
                """, (q, q, q))
                for row in cur.fetchall():
                    results.append({
                        "category": "Órdenes de Compra (OC)",
                        "title": f"OC {row[1]}",
                        "subtitle": f"Proveedor: {row[2]} | Estado: {row[3]}",
                        "link": f"/compras/oc?code={row[1]}"
                    })

            # 5. CLIENTES
            # Requiere logistics:materials:view o reporting:view o ser superadmin
            if has_permission(user, "logistics:materials:view") or has_permission(user, "reporting:view") or user.get("role") == "superadmin":
                cur.execute("""
                    SELECT id, codigo, razon_social, ruc, contacto
                    FROM clientes
                    WHERE razon_social ILIKE %s OR codigo ILIKE %s OR ruc ILIKE %s OR contacto ILIKE %s
                    LIMIT 5
                """, (q, q, q, q))
                for row in cur.fetchall():
                    results.append({
                        "category": "Clientes",
                        "title": row[2],
                        "subtitle": f"Código: {row[1]} | RUC: {row[3] or '—'} | Contacto: {row[4] or '—'}",
                        "link": f"/admin/clientes-dashboard?id={row[0]}" if is_staff else f"/clientes?id={row[0]}"
                    })

            # 6. PROVEEDORES
            # Requiere logistics:stock:view o ser superadmin
            if has_permission(user, "logistics:stock:view") or user.get("role") == "superadmin":
                cur.execute("""
                    SELECT id, codigo, nombre, ruc, contacto
                    FROM proveedores
                    WHERE nombre ILIKE %s OR codigo ILIKE %s OR ruc ILIKE %s OR contacto ILIKE %s
                    LIMIT 5
                """, (q, q, q, q))
                for row in cur.fetchall():
                    results.append({
                        "category": "Proveedores",
                        "title": row[2],
                        "subtitle": f"Código: {row[1]} | RUC: {row[3] or '—'} | Contacto: {row[4] or '—'}",
                        "link": f"/compras/proveedores?code={row[1]}"
                    })

            # 7. USUARIOS
            # Requiere admin:users o ser superadmin
            if has_permission(user, "admin:users") or user.get("role") == "superadmin":
                cur.execute("""
                    SELECT id, username, email
                    FROM users
                    WHERE username ILIKE %s OR email ILIKE %s
                    LIMIT 5
                """, (q, q))
                for row in cur.fetchall():
                    results.append({
                        "category": "Usuarios",
                        "title": row[1],
                        "subtitle": f"Email: {row[2]}",
                        "link": "/admin/users"
                    })

    return results
