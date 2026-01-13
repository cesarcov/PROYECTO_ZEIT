from app.core.database import db_connection
from uuid import UUID
import json

def log_audit_event(
    *,
    user_id: UUID | None,
    username: str | None,
    action: str,
    endpoint: str,
    module: str,
    payload: dict | None = None,
    ip_address: str | None
):
    with db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO audit_logs (
                    user_id,
                    username,
                    action,
                    endpoint,
                    module,
                    payload,
                    ip_address
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """, (
                user_id,
                username,
                action,
                endpoint,
                module,
                json.dumps(payload) if payload else None,
                ip_address
            ))

        conn.commit()