"""Endpoints about the signed-in user themselves.

These cut across projects: a home page wants one call for "my time", not one
per project, so they sit outside the project-scoped routers.
"""

from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.api.routes.timesheets import entry_to_read
from app.core.security import hash_password, verify_password
from app.models.project import Project
from app.models.role import Feature
from app.models.timesheet import TimeEntry, Timesheet
from app.schemas.auth import AuthenticatedUser, PasswordChange, ProfileUpdate
from app.schemas.timesheet import TimeEntryRead
from app.services import timesheets as service
from app.services.rbac import accessible_project_ids, effective_permissions

router = APIRouter(prefix="/me", tags=["me"])


@router.patch("/profile", response_model=AuthenticatedUser, summary="Change your own details")
async def update_my_profile(
    payload: ProfileUpdate, current_user: CurrentUser, db: DbSession
) -> AuthenticatedUser:
    current_user.full_name = payload.full_name.strip()
    await db.commit()
    return AuthenticatedUser.model_validate(current_user)


@router.post(
    "/password",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Change your own password",
)
async def change_my_password(
    payload: PasswordChange, current_user: CurrentUser, db: DbSession
) -> Response:
    """Replace the caller's password, proving they know the current one.

    Requiring the current password means a walked-up-to session cannot be used
    to lock the owner out of their own account.
    """
    valid, _ = verify_password(payload.current_password, current_user.hashed_password)
    if not valid:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Your current password is not correct.")
    if payload.new_password == payload.current_password:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "The new password must differ from the current one."
        )

    current_user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/time",
    response_model=list[TimeEntryRead],
    summary="Time you logged, across every project",
)
async def read_my_time(
    current_user: CurrentUser,
    db: DbSession,
    limit: Annotated[int, Query(ge=1, le=100, description="Most recent entries to return")] = 20,
) -> list[TimeEntryRead]:
    """The caller's own entries, newest first.

    Access is re-checked rather than assumed from authorship: being moved off a
    project should take its time off your home page even though you logged it.
    """
    organization_wide, project_ids = await accessible_project_ids(
        db, user_id=current_user.id, feature=Feature.TIMESHEET
    )
    if not organization_wide and not project_ids:
        return []

    query = (
        select(TimeEntry, Timesheet, Project)
        .join(Timesheet, Timesheet.id == TimeEntry.timesheet_id)
        .join(Project, Project.id == Timesheet.project_id)
        .where(
            TimeEntry.creator_id == current_user.id,
            Project.organization_id == current_user.organization_id,
        )
        # assignees decide whether a private timesheet is visible, and are part
        # of the response, so they are loaded here rather than row by row.
        .options(selectinload(Timesheet.assignees))
        .order_by(TimeEntry.entry_date.desc(), TimeEntry.created_at.desc())
        .limit(limit)
    )
    if not organization_wide:
        query = query.where(Project.id.in_(project_ids))

    rows = (await db.execute(query)).all()

    can_manage: dict[int, bool] = {}
    visible: list[tuple[TimeEntry, Timesheet, Project]] = []
    for entry, timesheet, project in rows:
        if project.id not in can_manage:
            granted = await effective_permissions(
                db, user_id=current_user.id, project_id=project.id
            )
            can_manage[project.id] = granted[Feature.TIMESHEET].delete
        if service.may_see(timesheet, user_id=current_user.id, can_manage=can_manage[project.id]):
            visible.append((entry, timesheet, project))

    totals = await service.totals_for(db, [timesheet.id for _, timesheet, _ in visible])
    return [
        entry_to_read(
            entry, timesheet, project, totals[timesheet.id], current_user.id, current_user
        )
        for entry, timesheet, project in visible
    ]
