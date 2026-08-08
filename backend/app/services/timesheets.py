"""Timesheet totals and visibility."""

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.timesheet import TimeEntry, TimeEntryStatus, Timesheet, TimesheetAssignee


def split_minutes(total: int | None) -> tuple[int | None, int | None]:
    """Present a stored minute total as the hours/minutes pair the API uses."""
    if total is None:
        return None, None
    return divmod(total, 60)


def to_minutes(hours: int | None, minutes: int | None) -> int | None:
    """Combine an hours/minutes pair into a single total."""
    if hours is None and minutes is None:
        return None
    return (hours or 0) * 60 + (minutes or 0)


@dataclass(frozen=True, slots=True)
class Totals:
    """Minutes rolled up from a timesheet's entries."""

    logged: int = 0
    billable: int = 0
    billed: int = 0


async def totals_for(
    session: AsyncSession, timesheet_ids: list[int]
) -> dict[int, Totals]:
    """Sum entry minutes per timesheet, in one query for the whole page.

    Totals are always derived rather than stored, so they cannot drift away
    from the entries they describe.
    """
    if not timesheet_ids:
        return {}

    result = await session.execute(
        select(
            TimeEntry.timesheet_id,
            func.coalesce(func.sum(TimeEntry.logged_minutes), 0),
            func.coalesce(
                func.sum(TimeEntry.logged_minutes).filter(
                    TimeEntry.status == TimeEntryStatus.BILLABLE
                ),
                0,
            ),
            func.coalesce(
                func.sum(TimeEntry.logged_minutes).filter(
                    TimeEntry.status == TimeEntryStatus.BILLED
                ),
                0,
            ),
        )
        .where(TimeEntry.timesheet_id.in_(timesheet_ids))
        .group_by(TimeEntry.timesheet_id)
    )

    summed = {
        timesheet_id: Totals(logged=logged, billable=billable, billed=billed)
        for timesheet_id, logged, billable, billed in result.all()
    }
    # A timesheet with no entries still needs a row of zeroes.
    return {timesheet_id: summed.get(timesheet_id, Totals()) for timesheet_id in timesheet_ids}


def may_see(timesheet: Timesheet, *, user_id: int, can_manage: bool) -> bool:
    """Whether a user may see a timesheet.

    Private timesheets are visible only to the person who created them, the
    people assigned to them, and anyone whose role can manage timesheets —
    otherwise an administrator could not audit time they did not log.
    """
    if not timesheet.is_private:
        return True
    if can_manage or timesheet.creator_id == user_id:
        return True
    return any(assignee.user_id == user_id for assignee in timesheet.assignees)


def assignee_ids(timesheet: Timesheet) -> list[int]:
    return [assignee.user_id for assignee in timesheet.assignees]


def set_assignees(timesheet: Timesheet, user_ids: list[int]) -> None:
    timesheet.assignees = [
        TimesheetAssignee(user_id=user_id) for user_id in dict.fromkeys(user_ids)
    ]
