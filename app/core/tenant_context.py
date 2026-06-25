from contextvars import ContextVar
from typing import Optional

_tenant_db_url: ContextVar[Optional[str]] = ContextVar("_tenant_db_url", default=None)


def set_tenant_db(url: str) -> None:
    _tenant_db_url.set(url)


def get_tenant_db() -> Optional[str]:
    return _tenant_db_url.get()
