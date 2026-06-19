from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.audit.context import audit_context
from app.core.audit.service import save_audit_log
import time

class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        # Contexto base del request
        context = {
            "endpoint": request.url.path,
            "method": request.method,
            "ip_address": request.client.host if request.client else None,
            "user_agent": request.headers.get("user-agent"),
        }

        audit_context.set(context)

        try:
            response = await call_next(request)
            status = "SUCCESS"
            error = None
            return response

        except Exception as e:
            status = "FAIL"
            error = str(e)
            raise

        finally:
            elapsed = round(time.time() - start_time, 3)

            base_ctx = audit_context.get().copy()
            base_ctx.update({
                "status": status,
                "error_message": error,
                "duration": elapsed,
            })

            try:
                save_audit_log(base_ctx)
            except Exception:
                pass  # audit log failure never kills the HTTP response
