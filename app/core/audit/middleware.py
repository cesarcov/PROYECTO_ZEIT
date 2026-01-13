from starlette.middleware.base import BaseHTTPMiddleware
from fastapi import Request
from app.core.audit.service import log_audit_event

class AuditMiddleware(BaseHTTPMiddleware):

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        if request.method in ("POST", "PUT", "PATCH", "DELETE"):
            user = getattr(request.state, "user", None)

            self._audit(request, user)

        return response

    def _audit(self, request: Request, user):
        try:
            log_audit_event(
                user_id=user["id"] if user else None,
                username=user["username"] if user else None,
                action=request.method,
                endpoint=request.url.path,
                module=request.url.path.split("/")[1],
                ip_address=request.client.host if request.client else None
            )
        except Exception as e:
            print(f"❌ ERROR EN AUDIT: {e}")
