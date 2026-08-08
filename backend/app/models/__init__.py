"""ORM models.

Import every model module here so that ``Base.metadata`` is fully populated
before Alembic autogenerates a migration.
"""

from app.db.base import Base
from app.models.organization import RESERVED_SLUGS, Organization
from app.models.project import Project
from app.models.role import Feature, Role, RolePermission, RoleScope
from app.models.timesheet import (
    TimeEntry,
    TimeEntryStatus,
    Timesheet,
    TimesheetAssignee,
)
from app.models.user import User
from app.models.user_role import UserRole

__all__ = [
    "RESERVED_SLUGS",
    "Base",
    "Feature",
    "Organization",
    "Project",
    "Role",
    "RolePermission",
    "RoleScope",
    "TimeEntry",
    "TimeEntryStatus",
    "Timesheet",
    "TimesheetAssignee",
    "User",
    "UserRole",
]
