"""The people in an organization.

Creating an account is gated on the ``members`` permission, which only the
built-in Organization Admin holds by default. Everything is scoped to the
caller's own organization, so one tenant can neither see nor add people in
another.
"""

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import DbSession, require_permission
from app.core.security import hash_password
from app.models.project import Project
from app.models.role import Feature, Role
from app.models.timesheet import TimeEntry
from app.models.user import User
from app.models.user_role import UserRole
from app.schemas.user import MemberCreate, MemberRead, MemberRoleRead, MemberUpdate
from app.services import rbac

router = APIRouter(prefix="/users", tags=["users"])

CanViewMembers = Annotated[User, Depends(require_permission(Feature.MEMBERS, "view"))]
CanCreateMembers = Annotated[User, Depends(require_permission(Feature.MEMBERS, "create"))]
# Taking someone out of the workspace is the delete-level right.
CanRemoveMembers = Annotated[User, Depends(require_permission(Feature.MEMBERS, "delete"))]


def _to_read(user: User, logged_entries: int = 0) -> MemberRead:
    return MemberRead(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        logged_entries=logged_entries,
        roles=[
            MemberRoleRead(
                id=assignment.id,
                role=assignment.role.name,
                scope=assignment.role.scope,
                project=assignment.project.name if assignment.project else None,
            )
            for assignment in user.role_assignments
        ],
    )


async def _entry_counts(db: AsyncSession, user_ids: list[int]) -> dict[int, int]:
    """How many entries each person logged, in one query rather than per row."""
    if not user_ids:
        return {}
    result = await db.execute(
        select(TimeEntry.creator_id, func.count())
        .where(TimeEntry.creator_id.in_(user_ids))
        .group_by(TimeEntry.creator_id)
    )
    return {creator_id: count for creator_id, count in result.all()}


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
    people = list(result.scalars().all())
    counts = await _entry_counts(db, [person.id for person in people])
    return [_to_read(person, counts.get(person.id, 0)) for person in people]


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
    public_ids = list(dict.fromkeys(payload.project_ids))
    # Resolved once here; everything below grants against the row keys.
    project_ids = [(await _own_project(db, public_id, current_user)).id for public_id in public_ids]

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


@router.patch(
    "/{user_id}",
    response_model=MemberRead,
    summary="Take someone out of the workspace, or put them back",
)
async def update_member(
    user_id: int, payload: MemberUpdate, current_user: CanRemoveMembers, db: DbSession
) -> MemberRead:
    """Deactivate an account, or restore one.

    Deactivating ends their access everywhere — the token check reads this on
    every request — while leaving the time they logged attributed to them.
    """
    if payload.is_active:
        user = await db.get(User, user_id)
        if user is None or user.organization_id != current_user.organization_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")
    else:
        # Taking access away runs the same checks as deleting outright.
        user = await _removable(db, user_id, current_user)

    user.is_active = payload.is_active
    await db.commit()
    return _to_read(await _load_member(db, user.id))


@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete an account for good",
)
async def delete_member(user_id: int, current_user: CanRemoveMembers, db: DbSession) -> None:
    """Erase the account itself.

    Their role grants go with it. The time they logged does not — the entries
    survive with no author, which is why deactivating is the better answer
    unless the account was created by mistake or the law requires the row gone.
    """
    user = await _removable(db, user_id, current_user)
    await db.delete(user)
    await db.commit()


async def _removable(db: AsyncSession, user_id: int, actor: User) -> User:
    """The shared checks for taking someone out, whether softly or for good."""
    user = await db.get(User, user_id)
    if user is None or user.organization_id != actor.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "User not found")

    if user.id == actor.id:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "You cannot remove your own account. Ask another administrator.",
        )

    if not await rbac.has_role_manager(
        db, organization_id=user.organization_id, ignoring_user=user.id
    ):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "This is the only person left who can manage roles. Give someone else that role first.",
        )
    return user


async def _own_role(db: AsyncSession, role_id: int, actor: User) -> Role:
    """Another tenant's role reads as missing rather than forbidden."""
    role = await db.get(Role, role_id)
    if role is None or role.organization_id != actor.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Role not found")
    return role


async def _own_project(db: AsyncSession, project_id: uuid.UUID, actor: User) -> Project:
    """Exchange a project's public id for the row, inside the caller's tenant."""
    project = (
        await db.execute(
            select(Project).where(
                Project.public_id == project_id,
                Project.organization_id == actor.organization_id,
            )
        )
    ).scalar_one_or_none()
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")
    return project
