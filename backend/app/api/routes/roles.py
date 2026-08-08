"""Role and permission endpoints.

NOTE: authentication is not built yet, so these routes are currently open. Once
auth exists they must be restricted to members of the organization holding the
``roles`` permission — an organization admin by default.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.organization import Organization
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

DbSession = Annotated[AsyncSession, Depends(get_db)]


def _feature_label(feature: Feature) -> str:
    """Human-readable row heading, e.g. gantt -> "Gantt"."""
    overrides = {Feature.GANTT: "Gantt", Feature.TIMESHEET: "Timesheet"}
    return overrides.get(feature, feature.value.replace("_", " ").title())


FEATURE_ROWS = [FeatureRead(value=feature, label=_feature_label(feature)) for feature in Feature]


async def _get_organization(session: AsyncSession, organization_id: int) -> Organization:
    organization = await session.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return organization


async def _get_role(session: AsyncSession, role_id: int) -> Role:
    result = await session.execute(
        select(Role).where(Role.id == role_id).options(selectinload(Role.permissions))
    )
    role = result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


@router.get(
    "/organizations/{organization_id}/roles",
    response_model=RoleMatrixRead,
    summary="Read the permission matrix",
)
async def read_roles(organization_id: int, db: DbSession) -> RoleMatrixRead:
    """Return every role with a complete grid of feature permissions."""
    await _get_organization(db, organization_id)
    roles = await rbac.list_roles(db, organization_id)
    return RoleMatrixRead(
        features=FEATURE_ROWS,
        roles=[RoleRead.model_validate(role) for role in roles],
    )


@router.post(
    "/organizations/{organization_id}/roles",
    response_model=RoleRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a custom role",
)
async def create_role(organization_id: int, payload: RoleCreate, db: DbSession) -> RoleRead:
    await _get_organization(db, organization_id)

    slug = payload.name.strip().lower().replace(" ", "-")
    role = Role(
        organization_id=organization_id,
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

    return RoleRead.model_validate(await _get_role(db, role.id))


@router.put(
    "/roles/{role_id}/permissions",
    response_model=RoleRead,
    summary="Replace a role's permission matrix",
)
async def update_role_permissions(
    role_id: int, payload: PermissionMatrixUpdate, db: DbSession
) -> RoleRead:
    """Apply the checkbox grid.

    System roles keep their name and scope but their permissions stay editable,
    which is the whole point of the settings screen.
    """
    role = await _get_role(db, role_id)
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
    return RoleRead.model_validate(await _get_role(db, role_id))


@router.delete(
    "/roles/{role_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a custom role",
)
async def delete_role(role_id: int, db: DbSession) -> None:
    role = await _get_role(db, role_id)
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
async def grant_role(user_id: int, payload: UserRoleCreate, db: DbSession) -> UserRoleRead:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    role = await _get_role(db, payload.role_id)
    if role.organization_id != user.organization_id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "That role belongs to a different organization"
        )

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
