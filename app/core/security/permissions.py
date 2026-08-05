from fastapi import Depends, HTTPException

from app.core.security.dependencies import get_current_user


def require_permission(permission):
    """Acepta un permiso (str) o lista de permisos (list). Con lista basta con tener uno."""
    allowed = permission if isinstance(permission, list) else [permission]

    def dependency(user=Depends(get_current_user)):
        if not any(p in user["permissions"] for p in allowed):
            raise HTTPException(
                status_code=403,
                detail="No tiene permisos suficientes"
            )
        return user

    # Marca introspectable: `test_rbac_matrix` recorre TODAS las rutas y falla
    # si alguna no declara permiso (deny-by-default, F-000 / T-10). Sin este
    # atributo la comprobación tendría que adivinar por el nombre de la función.
    dependency.__erp_permissions__ = tuple(allowed)
    return dependency


def solo_autenticado(user=Depends(get_current_user)):
    """Marca explícita para endpoints que exponen datos PROPIOS del usuario.

    No hay permiso RBAC que conceder: cualquiera autenticado puede ver su
    perfil o sus preferencias. Declararlo así lo distingue de un endpoint al
    que simplemente se le olvidó poner el permiso.
    """
    return user


solo_autenticado.__erp_solo_autenticado__ = True
