from fastapi import Depends, HTTPException
from app.core.security.dependencies import get_current_user

def require_permission(permission):
    """Acepta un permiso (str) o lista de permisos (list). Con lista basta con tener uno."""
    def dependency(user = Depends(get_current_user)):
        allowed = permission if isinstance(permission, list) else [permission]
        if not any(p in user["permissions"] for p in allowed):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos suficientes"
            )
        return user
    return dependency
