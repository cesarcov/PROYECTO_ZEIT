from fastapi import Depends, HTTPException
from app.core.security.dependencies import get_current_user

def require_permission(permission: str):
    def dependency(user = Depends(get_current_user)):
        if permission not in user["permissions"]:
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos suficientes"
            )
        return user
    return dependency
