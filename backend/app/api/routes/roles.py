"""Role and permission endpoints.

Every route requires a signed-in user holding the matching ``roles``
permission, which the built-in Organization Admin has by default. Roles are
always looked up within the caller's own organization, so one tenant can never
read or change another's.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, require_permission
from app.models.project import Project
from app.models.role import Feature, Role, RolePermission
from app.models.user import User
from app.schemas.rbac import (
    FeatureRead,
    PermissionMatrixUpdate,
    RoleCreate,
    RoleMatrixRead,
    RoleRead,
    UserRoleCreate,
    UserRoleRead,
)
from app.services import rbac

router = APIRouter(tags=["roles"])

CanViewRoles = Annotated[User, Depends(require_permission(Feature.ROLES, "view"))]
CanCreateRoles = Annotated[User, Depends(require_permission(Feature.ROLES, "create"))]
CanEditRoles = Annotated[User, Depends(require_permission(Feature.ROLES, "edit"))]
CanDeleteRoles = Annotated[User, Depends(require_permission(Feature.ROLES, "delete"))]


def _feature_label(feature: Feature) -> str:
    """Human-readable row heading, e.g. gantt -> "Gantt"."""
    overrides = {Feature.GANTT: "Gantt", Feature.TIMESHEET: "Timesheet"}
    return overrides.get(feature, feature.value.replace("_", " ").title())


FEATURE_ROWS = [FeatureRead(value=feature, label=_feature_label(feature)) for feature in Feature]


async def _get_own_role(session: AsyncSession, role_id: int, actor: User) -> Role:
    """Load a role, treating another tenant's role as non-existent."""
    result = await session.execute(
        select(Role)
        .where(Role.id == role_id, Role.organization_id == actor.organization_id)
        .options(selectinload(Role.permissions))
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


@router.get("/roles", response_model=RoleMatrixRead, summary="Read the permission matrix")
async def read_roles(current_user: CanViewRoles, db: DbSession) -> RoleMatrixRead:
    """Return every role in the caller's organization with a complete grid."""
    roles = await rbac.list_roles(db, current_user.organization_id)
    return RoleMatrixRead(
        features=FEATURE_ROWS,
        roles=[RoleRead.model_validate(role) for role in roles],
    )


@router.post(
    "/roles",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom role",
)
async def create_role(payload: RoleCreate, current_user: CanCreateRoles, db: DbSession) -> RoleRead:
    slug = payload.name.strip().lower().replace(" ", "-")
    role = Role(
        organization_id=current_user.organization_id,
        name=payload.name.strip(),
        slug=slug,
        description=payload.description,
        scope=payload.scope,
        is_system=False,
        # A new role starts with no access; the admin grants it in the grid.
        permissions=rbac.build_permission_rows({}),
    )
    db.add(role)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"A role named {payload.name!r} exists"
        ) from exc

    return RoleRead.model_validate(await _get_own_role(db, role.id, current_user))


@router.put(
    "/roles/{role_id}/permissions",
    response_model=RoleRead,
    summary="Replace a role's permission matrix",
)
async def update_role_permissions(
    role_id: int,
    payload: PermissionMatrixUpdate,
    current_user: CanEditRoles,
    db: DbSession,
) -> RoleRead:
    """Apply the checkbox grid.

    System roles keep their name and scope but their permissions stay editable,
    which is the whole point of the settings screen.
    """
    role = await _get_own_role(db, role_id, current_user)
    submitted = {permission.feature: permission for permission in payload.permissions}
    existing = {permission.feature: permission for permission in role.permissions}

    for feature, incoming in submitted.items():
        row = existing.get(feature)
        if row is None:
            row = RolePermission(feature=feature)
            role.permissions.append(row)
        row.can_view = incoming.can_view
        row.can_create = incoming.can_create
        row.can_edit = incoming.can_edit
        row.can_delete = incoming.can_delete

    await db.commit()
    return RoleRead.model_validate(await _get_own_role(db, role_id, current_user))


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom role",
)
async def delete_role(role_id: int, current_user: CanDeleteRoles, db: DbSession) -> None:
    role = await _get_own_role(db, role_id, current_user)
    if role.is_system:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Built-in roles cannot be deleted. Adjust their permissions instead.",
        )
    await db.delete(role)
    await db.commit()


@router.post(
    "/users/{user_id}/roles",
    response_model=UserRoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Grant a role to a user",
)
async def grant_role(
    user_id: int, payload: UserRoleCreate, current_user: CanEditRoles, db: DbSession
) -> UserRoleRead:
    user = await db.get(User, user_id)
    if user is None or user.organization_id != current_user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    role = await _get_own_role(db, payload.role_id, current_user)

    if payload.project_id is not None:
        project = await db.get(Project, payload.project_id)
        if project is None or project.organization_id != current_user.organization_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

    try:
        assignment = await rbac.assign_role(
            db, user_id=user.id, role=role, project_id=payload.project_id
        )
        await db.commit()
    except rbac.RbacError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "That role is already granted") from exc

    return UserRoleRead.model_validate(assignment)
