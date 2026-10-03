from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, DECIMAL, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, date
from decimal import Decimal
from ..database import Base

class Department(Base):
    __tablename__ = 'department'

    department_id = Column(Integer, primary_key=True, index=True)
    department_name = Column(String, unique=True, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Staff(Base):
    __tablename__ = 'staff'

    staff_id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String)
    department_id = Column(Integer, ForeignKey('department.department_id'), index=True)
    job_title = Column(String)
    employment_type = Column(String)
    shift = Column(String)
    contact = Column(String)
    hire_date = Column(Date)
    is_active = Column(Boolean)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Role(Base):
    __tablename__ = 'role'

    role_id = Column(Integer, primary_key=True, index=True)
    role_name = Column(String, unique=True, index=True)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Permission(Base):
    __tablename__ = 'permission'

    permission_id = Column(Integer, primary_key=True, index=True)
    permission_code = Column(String, unique=True, index=True)
    category = Column(String)
    description = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class RolePermission(Base):
    __tablename__ = 'rolepermission'

    id = Column(Integer, primary_key=True, autoincrement=True)
    role_id = Column(Integer, ForeignKey('role.role_id'))
    permission_id = Column(Integer, ForeignKey('permission.permission_id'))
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StaffRole(Base):
    __tablename__ = 'staffrole'

    id = Column(Integer, primary_key=True, autoincrement=True)
    staff_id = Column(Integer, ForeignKey('staff.staff_id'))
    role_id = Column(Integer, ForeignKey('role.role_id'))
    assigned_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class K9Unit(Base):
    __tablename__ = 'k9unit'

    k9_id = Column(Integer, primary_key=True, index=True)
    dog_name = Column(String)
    breed = Column(String)
    specialty = Column(String)
    handler_staff_id = Column(Integer, ForeignKey('staff.staff_id'), index=True)
    status = Column(String)
    certification_expiry = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

