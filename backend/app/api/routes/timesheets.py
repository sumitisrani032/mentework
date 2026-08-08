"""Timesheet endpoints, nested under the project they belong to.

Access is checked against the ``timesheet`` feature *within that project*, so a
Member on one project cannot log time against another. Private timesheets are
filtered further — see ``app.services.timesheets.may_see``.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, require_project_permission
from app.models.project import Project
from app.models.role import Feature
from app.models.timesheet import TimeEntry, Timesheet
from app.models.user import User
from app.schemas.timesheet import (
    TimeEntryCreate,
    TimeEntryProjectRead,
    TimeEntryRead,
    TimeEntryTimesheetRead,
    TimesheetCreate,
    TimesheetRead,
)
from app.services import timesheets as service
from app.services.rbac import effective_permissions

router = APIRouter(prefix="/projects/{project_id}/timesheets", tags=["timesheets"])

CanViewTimesheets = Annotated[
    Project, Depends(require_project_permission(Feature.TIMESHEET, "view"))
]
CanCreateTimesheets = Annotated[
    Project, Depends(require_project_permission(Feature.TIMESHEET, "create"))
]


async def _can_manage(db: AsyncSession, user: User, project_id: int) -> bool:
    """Whether the user may see private timesheets they are not part of."""
    granted = await effective_permissions(db, user_id=user.id, project_id=project_id)
    return granted[Feature.TIMESHEET].delete


async def _load_timesheet(
    db: AsyncSession, project: Project, timesheet_id: int, user: User
) -> Timesheet:
    """Fetch a timesheet, hiding it entirely when it is not visible.

    A timesheet in another project, or a private one the caller has no part in,
    both come back as 404 rather than 403 — otherwise the response would
    confirm that it exists.
    """
    result = await db.execute(
        select(Timesheet)
        .where(Timesheet.id == timesheet_id, Timesheet.project_id == project.id)
        .options(selectinload(Timesheet.assignees))
    )
    timesheet = result.scalar_one_or_none()
    if timesheet is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timesheet not found")

    can_manage = await _can_manage(db, user, project.id)
    if not service.may_see(timesheet, user_id=user.id, can_manage=can_manage):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Timesheet not found")
    return timesheet


def _to_read(timesheet: Timesheet, totals: service.Totals, viewer_id: int) -> TimesheetRead:
    estimated_hours, estimated_mins = service.split_minutes(timesheet.estimated_minutes)
    logged_hours, logged_mins = service.split_minutes(totals.logged)
    billable_hours, billable_mins = service.split_minutes(totals.billable)
    billed_hours, billed_mins = service.split_minutes(totals.billed)

    return TimesheetRead(
        id=timesheet.id,
        title=timesheet.title,
        project_id=timesheet.project_id,
        estimated_hours=estimated_hours,
        estimated_mins=estimated_mins,
        logged_hours=logged_hours,
        logged_mins=logged_mins,
        billable_hours=billable_hours,
        billable_mins=billable_mins,
        billed_hours=billed_hours,
        billed_mins=billed_mins,
        creator_id=timesheet.creator_id,
        assigned=service.assignee_ids(timesheet),
        private=timesheet.is_private,
        archived=timesheet.is_archived,
        by_me=timesheet.creator_id == viewer_id,
        created_at=timesheet.created_at,
        updated_at=timesheet.updated_at,
    )


@router.get("", response_model=list[TimesheetRead], summary="List a project's timesheets")
async def read_timesheets(
    project: CanViewTimesheets, current_user: CurrentUser, db: DbSession
) -> list[TimesheetRead]:
    result = await db.execute(
        select(Timesheet)
        .where(Timesheet.project_id == project.id)
        .options(selectinload(Timesheet.assignees))
        .order_by(Timesheet.created_at)
    )
    all_timesheets = list(result.scalars().all())

    can_manage = await _can_manage(db, current_user, project.id)
    visible = [
        timesheet
        for timesheet in all_timesheets
        if service.may_see(timesheet, user_id=current_user.id, can_manage=can_manage)
    ]

    totals = await service.totals_for(db, [timesheet.id for timesheet in visible])
    return [_to_read(sheet, totals[sheet.id], current_user.id) for sheet in visible]


@router.post(
    "",
    response_model=TimesheetRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a timesheet",
)
async def create_timesheet(
    payload: TimesheetCreate,
    project: CanCreateTimesheets,
    current_user: CurrentUser,
    db: DbSession,
) -> TimesheetRead:
    if payload.assigned:
        await _check_assignees_are_colleagues(db, payload.assigned, current_user)

    timesheet = Timesheet(
        project_id=project.id,
        title=payload.title.strip(),
        estimated_minutes=service.to_minutes(payload.estimated_hours, payload.estimated_mins),
        is_private=payload.private,
        creator_id=current_user.id,
    )
    service.set_assignees(timesheet, payload.assigned)
    db.add(timesheet)
    await db.commit()

    reloaded = await _load_timesheet(db, project, timesheet.id, current_user)
    return _to_read(reloaded, service.Totals(), current_user.id)


@router.get("/{timesheet_id}", response_model=TimesheetRead, summary="Read a single timesheet")
async def read_timesheet(
    timesheet_id: int,
    project: CanViewTimesheets,
    current_user: CurrentUser,
    db: DbSession,
) -> TimesheetRead:
    timesheet = await _load_timesheet(db, project, timesheet_id, current_user)
    totals = await service.totals_for(db, [timesheet.id])
    return _to_read(timesheet, totals[timesheet.id], current_user.id)


@router.get(
    "/{timesheet_id}/time",
    response_model=list[TimeEntryRead],
    summary="List the time logged on a timesheet",
)
async def read_time_entries(
    timesheet_id: int,
    project: CanViewTimesheets,
    current_user: CurrentUser,
    db: DbSession,
) -> list[TimeEntryRead]:
    timesheet = await _load_timesheet(db, project, timesheet_id, current_user)

    result = await db.execute(
        select(TimeEntry)
        .where(TimeEntry.timesheet_id == timesheet.id)
        .order_by(TimeEntry.entry_date, TimeEntry.created_at)
    )
    entries = list(result.scalars().all())
    totals = await service.totals_for(db, [timesheet.id])

    return [
        _entry_to_read(entry, timesheet, project, totals[timesheet.id], current_user.id)
        for entry in entries
    ]


@router.post(
    "/{timesheet_id}/time",
    response_model=TimeEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log time against a timesheet",
)
async def create_time_entry(
    timesheet_id: int,
    payload: TimeEntryCreate,
    project: CanCreateTimesheets,
    current_user: CurrentUser,
    db: DbSession,
) -> TimeEntryRead:
    timesheet = await _load_timesheet(db, project, timesheet_id, current_user)
    if timesheet.is_archived:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This timesheet is archived and cannot take new time."
        )

    minutes = service.to_minutes(payload.logged_hours, payload.logged_mins) or 0
    entry = TimeEntry(
        timesheet_id=timesheet.id,
        entry_date=payload.date,
        logged_minutes=minutes,
        status=payload.status,
        description=payload.description,
        from_timer=payload.timer,
        creator_id=current_user.id,
    )
    db.add(entry)
    await db.commit()
    await db.refresh(entry)

    totals = await service.totals_for(db, [timesheet.id])
    return _entry_to_read(entry, timesheet, project, totals[timesheet.id], current_user.id)


def _entry_to_read(
    entry: TimeEntry,
    timesheet: Timesheet,
    project: Project,
    totals: service.Totals,
    viewer_id: int,
) -> TimeEntryRead:
    logged_hours, logged_mins = divmod(entry.logged_minutes, 60)
    sheet_logged_hours, sheet_logged_mins = service.split_minutes(totals.logged)
    estimated_hours, estimated_mins = service.split_minutes(timesheet.estimated_minutes)

    return TimeEntryRead(
        id=entry.id,
        status=entry.status,
        description=entry.description,
        date=entry.entry_date,
        created_at=entry.created_at,
        logged_hours=logged_hours,
        logged_mins=logged_mins,
        timer=entry.from_timer,
        by_me=entry.creator_id == viewer_id,
        project=TimeEntryProjectRead(id=project.id, name=project.name),
        creator_id=entry.creator_id,
        timesheet=TimeEntryTimesheetRead(
            id=timesheet.id,
            title=timesheet.title,
            assigned=service.assignee_ids(timesheet),
            private=timesheet.is_private,
            archived=timesheet.is_archived,
            logged_hours=sheet_logged_hours,
            logged_mins=sheet_logged_mins,
            estimated_hours=estimated_hours,
            estimated_mins=estimated_mins,
        ),
    )


async def _check_assignees_are_colleagues(
    db: AsyncSession, user_ids: list[int], actor: User
) -> None:
    """Refuse to assign someone from another organization."""
    result = await db.execute(
        select(User.id).where(User.id.in_(user_ids), User.organization_id == actor.organization_id)
    )
    found = set(result.scalars().all())
    missing = set(user_ids) - found
    if missing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Not members of this organization: {', '.join(str(m) for m in sorted(missing))}",
        )
