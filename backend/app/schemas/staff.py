from pydantic import BaseModel
from datetime import datetime, date
from decimal import Decimal
from typing import Optional, List

class DepartmentBase(BaseModel):
    department_name: Optional[str] = None
    description: Optional[str] = None

class DepartmentCreate(DepartmentBase):
    pass

class DepartmentResponse(DepartmentBase):
    department_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StaffBase(BaseModel):
    full_name: Optional[str] = None
    department_id: Optional[int] = None
    job_title: Optional[str] = None
    employment_type: Optional[str] = None
    shift: Optional[str] = None
    contact: Optional[str] = None
    hire_date: Optional[date] = None
    is_active: Optional[bool] = None

class StaffCreate(StaffBase):
    pass

class StaffResponse(StaffBase):
    staff_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RoleBase(BaseModel):
    role_name: Optional[str] = None
    description: Optional[str] = None

class RoleCreate(RoleBase):
    pass

class RoleResponse(RoleBase):
    role_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class PermissionBase(BaseModel):
    permission_code: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None

class PermissionCreate(PermissionBase):
    pass

class PermissionResponse(PermissionBase):
    permission_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class RolePermissionBase(BaseModel):
    role_id: Optional[int] = None
    permission_id: Optional[int] = None

class RolePermissionCreate(RolePermissionBase):
    pass

class RolePermissionResponse(RolePermissionBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StaffRoleBase(BaseModel):
    staff_id: Optional[int] = None
    role_id: Optional[int] = None
    assigned_date: Optional[date] = None

class StaffRoleCreate(StaffRoleBase):
    pass

class StaffRoleResponse(StaffRoleBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class K9UnitBase(BaseModel):
    dog_name: Optional[str] = None
    breed: Optional[str] = None
    specialty: Optional[str] = None
    handler_staff_id: Optional[int] = None
    status: Optional[str] = None
    certification_expiry: Optional[date] = None

class K9UnitCreate(K9UnitBase):
    pass

class K9UnitResponse(K9UnitBase):
    k9_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
