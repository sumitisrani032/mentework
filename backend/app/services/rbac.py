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
from app.models.user import User
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
            # FULL rather than MANAGE: managing a project's time means being
            # able to correct and remove entries logged by the team, and to see
            # private timesheets when auditing.
            Feature.TIMESHEET: FULL,
            Feature.TIME_ENTRY: FULL,
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
            Feature.TIME_ENTRY: MANAGE,
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
        # Time: can log and correct their own entries, cannot create timesheets.
        scope=RoleScope.PROJECT,
        permissions={
            Feature.PROJECTS: VIEW,
            Feature.TASKS: EDIT,
            # A member fills a timesheet in; setting one up is a manager's job.
            Feature.TIMESHEET: VIEW,
            Feature.TIME_ENTRY: MANAGE,
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


async def revoke_role(session: AsyncSession, assignment: UserRole) -> None:
    """Take one grant away.

    Refused when it is the last thing letting anyone in the organization edit
    roles: a workspace nobody can administer cannot be repaired from inside it.
    """
    if await _is_last_role_manager(session, assignment):
        raise RbacError(
            "This is the only role left that can manage roles. "
            "Grant it to someone else before removing it."
        )
    await session.delete(assignment)
    await session.flush()


async def _is_last_role_manager(session: AsyncSession, assignment: UserRole) -> bool:
    """Whether removing this grant would leave nobody able to edit roles."""
    role = await session.get(Role, assignment.role_id)
    assert role is not None  # the assignment could not exist without it

    if await has_role_manager(
        session, organization_id=role.organization_id, ignoring_assignment=assignment.id
    ):
        return False

    # Nobody else has it — so this grant only matters if it carried the right.
    granted = await session.execute(
        select(RolePermission.can_edit).where(
            RolePermission.role_id == assignment.role_id,
            RolePermission.feature == Feature.ROLES,
        )
    )
    return bool(granted.scalar_one_or_none())


async def has_role_manager(
    session: AsyncSession,
    *,
    organization_id: int,
    ignoring_assignment: int | None = None,
    ignoring_user: int | None = None,
    ignoring_role: int | None = None,
) -> bool:
    """Whether anyone still active in the organization can edit roles.

    The ignore arguments answer "would this still hold after I remove that?"
    without having to write the change first.
    """
    query = (
        select(UserRole.user_id)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .join(User, User.id == UserRole.user_id)
        .where(
            Role.organization_id == organization_id,
            RolePermission.feature == Feature.ROLES,
            RolePermission.can_edit.is_(True),
            User.is_active.is_(True),
        )
        .limit(1)
    )
    if ignoring_assignment is not None:
        query = query.where(UserRole.id != ignoring_assignment)
    if ignoring_user is not None:
        query = query.where(UserRole.user_id != ignoring_user)
    if ignoring_role is not None:
        query = query.where(UserRole.role_id != ignoring_role)

    return (await session.execute(query)).scalars().first() is not None


async def accessible_project_ids(
    session: AsyncSession,
    *,
    user_id: int,
    feature: Feature,
    action: str = "view",
) -> tuple[bool, set[int]]:
    """Work out which projects a user may act on, without a query per project.

    Returns ``(organization_wide, project_ids)``. When the first is true the
    user holds the permission everywhere and the set can be ignored.
    """
    column = {
        "view": RolePermission.can_view,
        "create": RolePermission.can_create,
        "edit": RolePermission.can_edit,
        "delete": RolePermission.can_delete,
    }[action]

    result = await session.execute(
        select(UserRole.project_id)
        .join(Role, Role.id == UserRole.role_id)
        .join(RolePermission, RolePermission.role_id == Role.id)
        .where(
            UserRole.user_id == user_id,
            RolePermission.feature == feature,
            column.is_(True),
        )
        .distinct()
    )
    project_ids = set(result.scalars().all())
    organization_wide = None in project_ids
    project_ids.discard(None)
    return organization_wide, project_ids


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
