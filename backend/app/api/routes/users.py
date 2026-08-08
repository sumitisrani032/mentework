"""The people in an organization.

Creating an account is gated on the ``members`` permission, which only the
built-in Organization Admin holds by default. Everything is scoped to the
caller's own organization, so one tenant can neither see nor add people in
another.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, require_permission
from app.core.security import hash_password
from app.models.project import Project
from app.models.role import Feature, Role
from app.models.user import User
from app.models.user_role import UserRole
from app.schemas.user import MemberCreate, MemberRead, MemberRoleRead
from app.services import rbac

router = APIRouter(prefix="/users", tags=["users"])

CanViewMembers = Annotated[User, Depends(require_permission(Feature.MEMBERS, "view"))]
CanCreateMembers = Annotated[User, Depends(require_permission(Feature.MEMBERS, "create"))]


def _to_read(user: User) -> MemberRead:
    return MemberRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        roles=[
            MemberRoleRead(
                role=assignment.role.name,
                scope=assignment.role.scope,
                project=assignment.project.name if assignment.project else None,
            )
            for assignment in user.role_assignments
        ],
    )


async def _load_member(db: AsyncSession, user_id: int) -> User:
    """Re-read a user with their grants, so the response names their roles."""
    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(
            selectinload(User.role_assignments).selectinload(UserRole.role),
            selectinload(User.role_assignments).selectinload(UserRole.project),
        )
    )
    return result.scalar_one()


@router.get("", response_model=list[MemberRead], summary="List the people in your organization")
async def read_members(current_user: CanViewMembers, db: DbSession) -> list[MemberRead]:
    result = await db.execute(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .options(
            selectinload(User.role_assignments).selectinload(UserRole.role),
            selectinload(User.role_assignments).selectinload(UserRole.project),
        )
        .order_by(User.full_name)
    )
    return [_to_read(user) for user in result.scalars().all()]


@router.post(
    "",
    response_model=MemberRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a person and give them a role",
)
async def create_member(
    payload: MemberCreate, current_user: CanCreateMembers, db: DbSession
) -> MemberRead:
    role = await _own_role(db, payload.role_id, current_user)
    # Deduplicated: the same project twice would collide on the uniqueness
    # constraint over (user, role, project) and read as a server error.
    project_ids = list(dict.fromkeys(payload.project_ids))
    for project_id in project_ids:
        await _own_project(db, project_id, current_user)

    user = User(
        organization_id=current_user.organization_id,
        # Stored lowercased so the per-organization uniqueness constraint is
        # effectively case-insensitive.
        email=payload.email.strip().lower(),
        full_name=payload.full_name.strip(),
        hashed_password=hash_password(payload.password),
    )
    db.add(user)

    try:
        await db.flush()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Someone with the address {payload.email!r} is already in this workspace.",
        ) from exc

    # No projects means one organization-wide grant; the scope check inside
    # assign_role rejects whichever of the two does not match the role.
    try:
        for project_id in project_ids or [None]:
            await rbac.assign_role(db, user_id=user.id, role=role, project_id=project_id)
    except rbac.RbacError as exc:
        await db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc

    await db.commit()
    return _to_read(await _load_member(db, user.id))


async def _own_role(db: AsyncSession, role_id: int, actor: User) -> Role:
    """Another tenant's role reads as missing rather than forbidden."""
    role = await db.get(Role, role_id)
    if role is None or role.organization_id != actor.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


async def _own_project(db: AsyncSession, project_id: int, actor: User) -> Project:
    project = await db.get(Project, project_id)
    if project is None or project.organization_id != actor.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project
