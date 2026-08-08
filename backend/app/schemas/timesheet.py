from datetime import date, datetime

from pydantic import BaseModel, Field, model_validator

from app.models.timesheet import TimeEntryStatus


class HoursMinutes(BaseModel):
    """The hours/minutes pair the API speaks in.

    Stored internally as a single minute total, so "1h 90m" can never be
    persisted.
    """

    hours: int | None = Field(default=None, ge=0)
    mins: int | None = Field(default=None, ge=0, le=59)


class TimesheetCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    estimated_hours: int | None = Field(default=None, ge=0)
    estimated_mins: int | None = Field(default=None, ge=0, le=59)
    assigned: list[int] = Field(default_factory=list)
    private: bool = False


class TimesheetRead(BaseModel):
    id: int
    title: str
    project_id: int

    estimated_hours: int | None
    estimated_mins: int | None
    # Rolled up from the entries below, never stored.
    logged_hours: int | None
    logged_mins: int | None
    billable_hours: int | None
    billable_mins: int | None
    billed_hours: int | None
    billed_mins: int | None

    creator_id: int | None
    assigned: list[int]
    private: bool
    archived: bool
    by_me: bool
    created_at: datetime
    updated_at: datetime


class TimeEntryCreate(BaseModel):
    date: date
    # Accepted as strings or numbers, matching the shape clients already send.
    logged_hours: int | None = Field(default=None, ge=0)
    logged_mins: int | None = Field(default=None, ge=0, le=59)
    status: TimeEntryStatus = TimeEntryStatus.NONE
    description: str | None = None
    timer: bool = False

    @model_validator(mode="after")
    def some_time_must_be_logged(self) -> "TimeEntryCreate":
        total = (self.logged_hours or 0) * 60 + (self.logged_mins or 0)
        if total <= 0:
            raise ValueError("logged_hours and logged_mins cannot both be zero")
        return self


class ImportRowError(BaseModel):
    """One thing wrong with the uploaded file, addressed by row and column."""

    row: int
    column: str
    message: str


class TimeImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    logged_hours: int
    logged_mins: int
    dry_run: bool


class TimeImportRejected(BaseModel):
    """Returned with 422 when nothing was written."""

    message: str
    errors: list[ImportRowError]


class TimeEntryTimesheetRead(BaseModel):
    """The nested timesheet summary returned alongside each entry."""

    id: int
    title: str
    assigned: list[int]
    private: bool
    archived: bool
    logged_hours: int | None
    logged_mins: int | None
    estimated_hours: int | None
    estimated_mins: int | None


class TimeEntryProjectRead(BaseModel):
    id: int
    name: str


class TimeEntryRead(BaseModel):
    id: int
    status: TimeEntryStatus
    description: str | None
    date: date
    created_at: datetime
    logged_hours: int
    logged_mins: int
    timer: bool
    by_me: bool
    project: TimeEntryProjectRead
    creator_id: int | None
    task: None = None
    timesheet: TimeEntryTimesheetRead
