from pydantic import BaseModel, EmailStr
from uuid import UUID
from typing import List


class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role_ids: List[UUID]


class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    is_active: bool
    roles: List[str]


class AssignRoles(BaseModel):
    role_ids: List[UUID]

class UserRolesUpdate(BaseModel):
    role_ids: List[UUID]


class UserStatusUpdate(BaseModel):
    is_active: bool


class RolePermissionsUpdate(BaseModel):
    permission_codes: List[str]


class RoleCreate(BaseModel):
    name: str
