from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    # Logged time carrying no billing status yet.
    non_billable_hours: int | None
    non_billable_mins: int | None

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


class ImportPreviewRow(BaseModel):
    """One parsed row, so the uploader can check it before committing."""

    row: int
    date: date
    logged_hours: int
    logged_mins: int
    description: str | None
    status: TimeEntryStatus
    duplicate: bool


class TimeImportResult(BaseModel):
    imported: int
    skipped_duplicates: int
    logged_hours: int
    logged_mins: int
    dry_run: bool
    # Filled on a dry run only, so a real import does not echo the whole file.
    preview: list[ImportPreviewRow] = Field(default_factory=list)


class TimeImportRejected(BaseModel):
    """Returned with 422 when nothing was written."""

    message: str
    errors: list[ImportRowError]


class TimeEntryUpdate(BaseModel):
    """A partial change to one entry.

    Only fields actually present in the request body are applied, so omitting
    ``description`` leaves it alone while sending it as null clears it.
    """

    model_config = ConfigDict(populate_by_name=True)

    # Called entry_date rather than date: an assignment named `date` shadows
    # the imported date type while the class body is still executing, so the
    # annotation on the very next line would fail to resolve.
    entry_date: date | None = Field(default=None, alias="date")
    logged_hours: int | None = Field(default=None, ge=0)
    logged_mins: int | None = Field(default=None, ge=0, le=59)
    status: TimeEntryStatus | None = None
    description: str | None = None

    @model_validator(mode="after")
    def a_new_duration_must_be_positive(self) -> "TimeEntryUpdate":
        changing_duration = {"logged_hours", "logged_mins"} & self.model_fields_set
        if not changing_duration:
            return self
        # Either part alone sets the whole duration; the other counts as zero.
        if (self.logged_hours or 0) * 60 + (self.logged_mins or 0) <= 0:
            raise ValueError("logged_hours and logged_mins cannot both be zero")
        return self


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


class LoggedByRead(BaseModel):
    """Who logged an entry, so a shared timesheet reads as a team's work.

    Everyone who can see the timesheet sees this — that is the point of a
    project timesheet. Nothing beyond a display name is exposed.
    """

    id: int
    full_name: str
    initials: str


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
    logged_by: LoggedByRead | None
    task: None = None
    timesheet: TimeEntryTimesheetRead
