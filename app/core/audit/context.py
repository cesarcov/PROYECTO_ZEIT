from contextvars import ContextVar

# El default es None, no {}: un dict como default de ContextVar es un ÚNICO
# objeto compartido por todos los contextos, así que cualquier mutación in-place
# se filtraría entre peticiones (F-000 / T-06, regla B039 del linter).
audit_context: ContextVar[dict | None] = ContextVar("audit_context", default=None)


def get_audit_context() -> dict:
    """Contexto de auditoría de la petición actual, como copia segura de mutar."""
    actual = audit_context.get()
    return dict(actual) if actual else {}
