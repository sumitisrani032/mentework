"""Timesheet endpoints, nested under the project they belong to.

Access is checked against the ``timesheet`` feature *within that project*, so a
Member on one project cannot log time against another. Private timesheets are
filtered further — see ``app.services.timesheets.may_see``.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import PlainTextResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession, require_project_permission
from app.models.project import Project
from app.models.role import Feature
from app.models.timesheet import TimeEntry, Timesheet
from app.models.user import User
from app.schemas.timesheet import (
    ImportPreviewRow,
    ImportRowError,
    LoggedByRead,
    TimeEntryCreate,
    TimeEntryProjectRead,
    TimeEntryRead,
    TimeEntryTimesheetRead,
    TimeEntryUpdate,
    TimeImportRejected,
    TimeImportResult,
    TimesheetCreate,
    TimesheetRead,
)
from app.services import time_import
from app.services import timesheets as service
from app.services.rbac import effective_permissions

router = APIRouter(prefix="/projects/{project_id}/timesheets", tags=["timesheets"])

CanViewTimesheets = Annotated[
    Project, Depends(require_project_permission(Feature.TIMESHEET, "view"))
]
CanCreateTimesheets = Annotated[
    Project, Depends(require_project_permission(Feature.TIMESHEET, "create"))
]

# Logging time is its own permission: a member fills a timesheet in without
# being able to create, rename or archive one.
CanLogTime = Annotated[Project, Depends(require_project_permission(Feature.TIME_ENTRY, "create"))]
CanEditTime = Annotated[Project, Depends(require_project_permission(Feature.TIME_ENTRY, "edit"))]
CanDeleteTime = Annotated[
    Project, Depends(require_project_permission(Feature.TIME_ENTRY, "delete"))
]


async def _can_manage(db: AsyncSession, user: User, project_id: int) -> bool:
    """Whether the user may see private timesheets they are not part of."""
    granted = await effective_permissions(db, user_id=user.id, project_id=project_id)
    return granted[Feature.TIMESHEET].delete


async def _can_manage_time(db: AsyncSession, user: User, project_id: int) -> bool:
    """Whether the user may change entries other people logged."""
    granted = await effective_permissions(db, user_id=user.id, project_id=project_id)
    return granted[Feature.TIME_ENTRY].delete


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
    non_billable_hours, non_billable_mins = service.split_minutes(
        totals.logged - totals.billable - totals.billed
    )

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
        non_billable_hours=non_billable_hours,
        non_billable_mins=non_billable_mins,
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


# Declared before "/{timesheet_id}": routes match in order, so a literal path
# has to come first or it is swallowed by the timesheet_id parameter.
@router.get(
    "/import-template",
    response_class=PlainTextResponse,
    summary="Download a blank CSV to fill in",
)
async def read_import_template(project: CanViewTimesheets) -> PlainTextResponse:
    return PlainTextResponse(
        time_import.TEMPLATE,
        headers={"Content-Disposition": 'attachment; filename="time-import-template.csv"'},
    )


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
    authors = await _authors_of(db, entries)

    return [
        entry_to_read(
            entry,
            timesheet,
            project,
            totals[timesheet.id],
            current_user.id,
            authors.get(entry.creator_id),
        )
        for entry in entries
    ]


async def _authors_of(db: AsyncSession, entries: list[TimeEntry]) -> dict[int, User]:
    """Load every entry's author in one query, not one per row."""
    ids = {entry.creator_id for entry in entries if entry.creator_id is not None}
    if not ids:
        return {}
    result = await db.execute(select(User).where(User.id.in_(ids)))
    return {user.id: user for user in result.scalars().all()}


@router.post(
    "/{timesheet_id}/time",
    response_model=TimeEntryRead,
    status_code=status.HTTP_201_CREATED,
    summary="Log time against a timesheet",
)
async def create_time_entry(
    timesheet_id: int,
    payload: TimeEntryCreate,
    project: CanLogTime,
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
    return entry_to_read(
        entry, timesheet, project, totals[timesheet.id], current_user.id, current_user
    )


@router.post(
    "/{timesheet_id}/time/import",
    response_model=TimeImportResult,
    summary="Bulk-upload logged time from a CSV",
)
async def import_time_entries(
    timesheet_id: int,
    project: CanLogTime,
    current_user: CurrentUser,
    db: DbSession,
    file: Annotated[UploadFile, File(description="CSV: date, logged_hours, description, status")],
    dry_run: Annotated[bool, Query(description="Validate without saving")] = False,
    allow_duplicates: Annotated[
        bool, Query(description="Log rows that match time already recorded")
    ] = False,
) -> TimeImportResult:
    """Import a month of logged time in one go.

    The file is validated in full before anything is written: a single bad row
    rejects the upload with a list of what to fix, because a half-imported
    month is far harder to unpick than one that never landed.
    """
    timesheet = await _load_timesheet(db, project, timesheet_id, current_user)
    if timesheet.is_archived:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This timesheet is archived and cannot take new time."
        )

    parsed = time_import.parse_csv(await file.read(), today=datetime.now(UTC).date())
    if not parsed.ok:
        _reject(parsed.errors)

    # Re-uploading the same file is the most common way to double-count a
    # month, so matching rows are skipped unless explicitly allowed.
    existing = (
        set()
        if allow_duplicates
        else await _existing_fingerprints(db, timesheet.id, current_user.id)
    )
    duplicates = {
        entry.row for entry in parsed.entries if time_import.fingerprint(entry) in existing
    }
    to_write = [entry for entry in parsed.entries if entry.row not in duplicates]
    skipped = len(duplicates)

    if not dry_run and to_write:
        db.add_all(
            TimeEntry(
                timesheet_id=timesheet.id,
                entry_date=entry.entry_date,
                logged_minutes=entry.logged_minutes,
                status=entry.status,
                description=entry.description,
                creator_id=current_user.id,
            )
            for entry in to_write
        )
        await db.commit()

    written_minutes = sum(entry.logged_minutes for entry in to_write)
    hours, minutes = divmod(written_minutes, 60)
    return TimeImportResult(
        imported=len(to_write),
        skipped_duplicates=skipped,
        logged_hours=hours,
        logged_mins=minutes,
        dry_run=dry_run,
        # Every row, including the duplicates, so the preview can show what
        # will be skipped rather than silently dropping it.
        preview=[_preview_row(entry, entry.row in duplicates) for entry in parsed.entries]
        if dry_run
        else [],
    )


def _preview_row(entry: time_import.ParsedEntry, duplicate: bool) -> ImportPreviewRow:
    hours, minutes = divmod(entry.logged_minutes, 60)
    return ImportPreviewRow(
        row=entry.row,
        date=entry.entry_date,
        logged_hours=hours,
        logged_mins=minutes,
        description=entry.description,
        status=entry.status,
        duplicate=duplicate,
    )


async def _load_entry(
    db: AsyncSession,
    project: Project,
    timesheet_id: int,
    entry_id: int,
    user: User,
    *,
    action: str,
) -> tuple[TimeEntry, Timesheet]:
    """Load an entry the caller is allowed to change.

    Missing and invisible are both 404. Somebody else's entry is 403, because
    at that point the caller already knows it exists.
    """
    timesheet = await _load_timesheet(db, project, timesheet_id, user)
    if timesheet.is_archived:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "This timesheet is archived and cannot be changed."
        )

    entry = await db.get(TimeEntry, entry_id)
    if entry is None or entry.timesheet_id != timesheet.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Time entry not found")

    can_manage = await _can_manage_time(db, user, project.id)
    if not service.may_modify(entry, user_id=user.id, can_manage=can_manage):
        raise HTTPException(
            status.HTTP_403_FORBIDDEN,
            f"You can only {action} time you logged yourself.",
        )
    return entry, timesheet


@router.patch(
    "/{timesheet_id}/time/{entry_id}",
    response_model=TimeEntryRead,
    summary="Change a logged time entry",
)
async def update_time_entry(
    timesheet_id: int,
    entry_id: int,
    payload: TimeEntryUpdate,
    project: CanEditTime,
    current_user: CurrentUser,
    db: DbSession,
) -> TimeEntryRead:
    entry, timesheet = await _load_entry(
        db, project, timesheet_id, entry_id, current_user, action="edit"
    )

    changed = payload.model_fields_set
    if "entry_date" in changed and payload.entry_date is not None:
        if payload.entry_date > datetime.now(UTC).date():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "Time cannot be logged before it is spent.",
            )
        entry.entry_date = payload.entry_date
    if changed & {"logged_hours", "logged_mins"}:
        entry.logged_minutes = (payload.logged_hours or 0) * 60 + (payload.logged_mins or 0)
    if "status" in changed and payload.status is not None:
        entry.status = payload.status
    if "description" in changed:
        entry.description = (payload.description or "").strip() or None

    await db.commit()
    await db.refresh(entry)

    totals = await service.totals_for(db, [timesheet.id])
    return entry_to_read(
        entry, timesheet, project, totals[timesheet.id], current_user.id, current_user
    )


@router.delete(
    "/{timesheet_id}/time/{entry_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Remove a logged time entry",
)
async def delete_time_entry(
    timesheet_id: int,
    entry_id: int,
    project: CanDeleteTime,
    current_user: CurrentUser,
    db: DbSession,
) -> None:
    entry, _ = await _load_entry(db, project, timesheet_id, entry_id, current_user, action="delete")
    await db.delete(entry)
    await db.commit()


def _reject(errors: list[time_import.RowError]) -> None:
    """Turn parse errors into a 422 the uploader can act on."""
    shown = errors[:50]
    raise HTTPException(
        status.HTTP_422_UNPROCESSABLE_CONTENT,
        detail=TimeImportRejected(
            message=(
                f"Nothing was imported: {len(errors)} problem(s) in the file."
                + ("" if len(shown) == len(errors) else f" Showing the first {len(shown)}.")
            ),
            errors=[
                ImportRowError(row=error.row, column=error.column, message=error.message)
                for error in shown
            ],
        ).model_dump(),
    )


async def _existing_fingerprints(
    db: AsyncSession, timesheet_id: int, creator_id: int
) -> set[tuple]:
    result = await db.execute(
        select(
            TimeEntry.entry_date,
            TimeEntry.logged_minutes,
            TimeEntry.description,
            TimeEntry.status,
        ).where(TimeEntry.timesheet_id == timesheet_id, TimeEntry.creator_id == creator_id)
    )
    return {
        (entry_date, minutes, description, status.value)
        for entry_date, minutes, description, status in result.all()
    }


def _initials(full_name: str) -> str:
    parts = [part for part in full_name.split() if part]
    if not parts:
        return "?"
    return (parts[0][0] + (parts[-1][0] if len(parts) > 1 else "")).upper()


def entry_to_read(
    entry: TimeEntry,
    timesheet: Timesheet,
    project: Project,
    totals: service.Totals,
    viewer_id: int,
    logged_by: User | None = None,
) -> TimeEntryRead:
    """Serialise one entry with the timesheet and project it belongs to.

    Public because the cross-project ``/me/time`` listing returns the same
    shape: one entry should read identically wherever it is shown.
    """
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
        logged_by=LoggedByRead(
            id=logged_by.id,
            full_name=logged_by.full_name,
            initials=_initials(logged_by.full_name),
        )
        if logged_by is not None
        else None,
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
