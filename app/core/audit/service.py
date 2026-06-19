from app.core.database import db_connection
from app.core.audit.context import audit_context


def save_audit_log(extra_data: dict = None):
    ctx = audit_context.get().copy()

    if extra_data:
        ctx.update(extra_data)

    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO audit_logs (
                    user_id, username, roles,
                    action, module, entity, entity_id,
                    endpoint, method,
                    old_data, new_data,
                    ip_address, user_agent,
                    status, error_message
                )
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (
                ctx.get("user_id"),
                ctx.get("username"),
                ctx.get("roles"),
                ctx.get("action") or "REQUEST",
                ctx.get("module") or "system",
                ctx.get("entity"),
                ctx.get("entity_id"),
                ctx.get("endpoint"),
                ctx.get("method"),
                ctx.get("old_data"),
                ctx.get("new_data"),
                ctx.get("ip_address"),
                ctx.get("user_agent"),
                ctx.get("status") or "SUCCESS",
                ctx.get("error_message"),
            ))

        conn.commit()
