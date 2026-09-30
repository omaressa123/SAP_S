from sqlalchemy.orm import Session
from .base import BaseRepository
from ..models.staff import Department, Staff, Role, Permission, RolePermission, StaffRole, K9Unit

class DepartmentRepository(BaseRepository[Department]):
    def __init__(self):
        super().__init__(Department)

department_repo = DepartmentRepository()

class StaffRepository(BaseRepository[Staff]):
    def __init__(self):
        super().__init__(Staff)

staff_repo = StaffRepository()

class RoleRepository(BaseRepository[Role]):
    def __init__(self):
        super().__init__(Role)

role_repo = RoleRepository()

class PermissionRepository(BaseRepository[Permission]):
    def __init__(self):
        super().__init__(Permission)

permission_repo = PermissionRepository()

class RolePermissionRepository(BaseRepository[RolePermission]):
    def __init__(self):
        super().__init__(RolePermission)

rolepermission_repo = RolePermissionRepository()

class StaffRoleRepository(BaseRepository[StaffRole]):
    def __init__(self):
        super().__init__(StaffRole)

staffrole_repo = StaffRoleRepository()

class K9UnitRepository(BaseRepository[K9Unit]):
    def __init__(self):
        super().__init__(K9Unit)

k9unit_repo = K9UnitRepository()
