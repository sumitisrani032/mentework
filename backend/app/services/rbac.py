"""Role and permission logic.

The default roles below mirror the product's intended access model. They are
seeded per organization and marked ``is_system``: an admin may retune their
permission matrix but cannot delete or rename them.
"""

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.organization import Organization
from app.models.role import Feature, Role, RolePermission, RoleScope
from app.models.user_role import UserRole


@dataclass(frozen=True, slots=True)
class PermissionSet:
    """The four checkboxes shown for one feature in one role."""

    view: bool = False
    create: bool = False
    edit: bool = False
    delete: bool = False


# Shorthands for the presets used by the seeded roles.
FULL = PermissionSet(view=True, create=True, edit=True, delete=True)
MANAGE = PermissionSet(view=True, create=True, edit=True)
CONTRIBUTE = PermissionSet(view=True, create=True)
EDIT = PermissionSet(view=True, edit=True)
VIEW = PermissionSet(view=True)
NONE = PermissionSet()


@dataclass(frozen=True, slots=True)
class RoleDefinition:
    slug: str
    name: str
    description: str
    scope: RoleScope
    permissions: dict[Feature, PermissionSet]


DEFAULT_ROLES: tuple[RoleDefinition, ...] = (
    RoleDefinition(
        slug="organization-admin",
        name="Organization Admin",
        description="Manage users, roles, projects, settings, billing and reports.",
        scope=RoleScope.ORGANIZATION,
        permissions={feature: FULL for feature in Feature},
    ),
    RoleDefinition(
        slug="project-manager",
        name="Project Manager",
        description="Create and manage projects, tasks, schedules, members and reports.",
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: MANAGE,
            Feature.TASKS: FULL,
            Feature.TIMESHEET: MANAGE,
            Feature.GANTT: MANAGE,
            Feature.CALENDAR: MANAGE,
            Feature.DISCUSSIONS: FULL,
            Feature.FILES: FULL,
            Feature.REPORTS: VIEW,
            Feature.MEMBERS: MANAGE,
        },
    ),
    RoleDefinition(
        slug="team-lead",
        name="Team Lead",
        description="Assign tasks, manage team workload and review progress.",
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: VIEW,
            Feature.TASKS: MANAGE,
            Feature.TIMESHEET: VIEW,
            Feature.GANTT: EDIT,
            Feature.CALENDAR: VIEW,
            Feature.DISCUSSIONS: CONTRIBUTE,
            Feature.FILES: CONTRIBUTE,
            Feature.REPORTS: VIEW,
            Feature.MEMBERS: VIEW,
        },
    ),
    RoleDefinition(
        slug="member",
        name="Member",
        description="Work on assigned tasks, update status, log time and add notes or files.",
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: VIEW,
            Feature.TASKS: EDIT,
            Feature.TIMESHEET: MANAGE,
            Feature.GANTT: VIEW,
            Feature.CALENDAR: VIEW,
            Feature.DISCUSSIONS: CONTRIBUTE,
            Feature.FILES: CONTRIBUTE,
            Feature.MEMBERS: VIEW,
        },
    ),
    RoleDefinition(
        slug="client",
        name="Client",
        description="View shared project information, comment and review work.",
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: VIEW,
            Feature.TASKS: VIEW,
            Feature.GANTT: VIEW,
            Feature.CALENDAR: VIEW,
            Feature.DISCUSSIONS: CONTRIBUTE,
            Feature.FILES: VIEW,
        },
    ),
    RoleDefinition(
        slug="viewer",
        name="Viewer",
        description="Read-only access to shared project information.",
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: VIEW,
            Feature.TASKS: VIEW,
            Feature.GANTT: VIEW,
            Feature.CALENDAR: VIEW,
            Feature.DISCUSSIONS: VIEW,
            Feature.FILES: VIEW,
        },
    ),
)


class RbacError(Exception):
    """Raised when a role operation is not allowed."""


def build_permission_rows(permissions: dict[Feature, PermissionSet]) -> list[RolePermission]:
    """Expand a role definition into a full matrix.

    Every feature gets a row, including the ones the role cannot touch, so the
    settings grid always has a complete set of checkboxes to render.
    """
    return [
        RolePermission(
            feature=feature,
            can_view=(granted := permissions.get(feature, NONE)).view,
            can_create=granted.create,
            can_edit=granted.edit,
            can_delete=granted.delete,
        )
        for feature in Feature
    ]


async def seed_default_roles(session: AsyncSession, organization: Organization) -> list[Role]:
    """Create the built-in roles for a newly created organization."""
    roles = [
        Role(
            organization_id=organization.id,
            slug=definition.slug,
            name=definition.name,
            description=definition.description,
            scope=definition.scope,
            is_system=True,
            permissions=build_permission_rows(definition.permissions),
        )
        for definition in DEFAULT_ROLES
    ]
    session.add_all(roles)
    await session.flush()
    return roles


async def list_roles(session: AsyncSession, organization_id: int) -> list[Role]:
    """Return an organization's roles with their permission matrices loaded."""
    result = await session.execute(
        select(Role)
        .where(Role.organization_id == organization_id)
        .options(selectinload(Role.permissions))
        .order_by(Role.is_system.desc(), Role.name)
    )
    return list(result.scalars().all())


async def assign_role(
    session: AsyncSession,
    *,
    user_id: int,
    role: Role,
    project_id: int | None = None,
) -> UserRole:
    """Grant a role to a user, enforcing the role's scope.

    A project role must name a project; an organization role must not. The
    database cannot check this itself because the rule depends on a column of
    another table.
    """
    if role.scope is RoleScope.PROJECT and project_id is None:
        raise RbacError(f"Role {role.slug!r} is project-scoped and needs a project.")
    if role.scope is RoleScope.ORGANIZATION and project_id is not None:
        raise RbacError(f"Role {role.slug!r} applies organization-wide and cannot name a project.")

    assignment = UserRole(user_id=user_id, role_id=role.id, project_id=project_id)
    session.add(assignment)
    await session.flush()
    return assignment


async def effective_permissions(
    session: AsyncSession,
    *,
    user_id: int,
    project_id: int | None = None,
) -> dict[Feature, PermissionSet]:
    """Resolve what a user may do, in the context of a project if given.

    Permissions are the union across every role that applies: organization-wide
    grants always count, and project grants count only for that project. Roles
    can therefore only add access, never remove it.
    """
    conditions = [UserRole.user_id == user_id]
    if project_id is None:
        conditions.append(UserRole.project_id.is_(None))
    else:
        conditions.append((UserRole.project_id == project_id) | (UserRole.project_id.is_(None)))

    result = await session.execute(
        select(RolePermission)
        .join(Role, Role.id == RolePermission.role_id)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(*conditions)
    )

    granted: dict[Feature, PermissionSet] = {feature: NONE for feature in Feature}
    for row in result.scalars().all():
        current = granted[row.feature]
        granted[row.feature] = PermissionSet(
            view=current.view or row.can_view,
            create=current.create or row.can_create,
            edit=current.edit or row.can_edit,
            delete=current.delete or row.can_delete,
        )
    return granted
