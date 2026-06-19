from contextvars import ContextVar

audit_context: ContextVar[dict] = ContextVar("audit_context", default={})
