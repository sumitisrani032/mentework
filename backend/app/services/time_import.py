"""Parse a CSV of logged time into time entries.

The file is validated as a whole before anything is written. A month's upload
that is half-applied is far harder to reconcile than one that is rejected with
a list of what to fix, so a single bad row rejects the file.
"""

import csv
import io
from dataclasses import dataclass, field
from datetime import date

from app.models.timesheet import TimeEntryStatus

# A month of daily entries is a few dozen rows; this is a generous ceiling that
# still stops a single request from tying up the server.
MAX_ROWS = 1000
MAX_BYTES = 2 * 1024 * 1024

# One entry cannot be longer than a day.
MAX_MINUTES_PER_ENTRY = 24 * 60

REQUIRED_COLUMNS = ("date", "logged_hours")

# People export these files from all sorts of tools, so accept the obvious
# spellings rather than making them rename columns.
COLUMN_ALIASES = {
    "date": "date",
    "day": "date",
    "logged_hours": "logged_hours",
    "log_hours": "logged_hours",
    "hours": "logged_hours",
    "time": "logged_hours",
    "duration": "logged_hours",
    "description": "description",
    "notes": "description",
    "note": "description",
    "comment": "description",
    "status": "status",
    "billing": "status",
    "billing_status": "status",
}

TEMPLATE = (
    "date,logged_hours,description,status\n"
    "2026-10-05,1:40,Brainstorm session with potential users,billable\n"
    "2026-10-06,2.5,Drafted the onboarding emails,none\n"
)


@dataclass(frozen=True, slots=True)
class RowError:
    row: int
    column: str
    message: str


@dataclass(frozen=True, slots=True)
class ParsedEntry:
    # The line it came from, so a preview can point back at the file.
    row: int
    entry_date: date
    logged_minutes: int
    description: str | None
    status: TimeEntryStatus


@dataclass
class ParseResult:
    entries: list[ParsedEntry] = field(default_factory=list)
    errors: list[RowError] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.errors

    @property
    def total_minutes(self) -> int:
        return sum(entry.logged_minutes for entry in self.entries)


def normalise_header(name: str) -> str:
    cleaned = name.strip().lower().replace("-", "_").replace(" ", "_")
    return COLUMN_ALIASES.get(cleaned, cleaned)


SHAPE_HINT = "use 1:40 (hours:minutes) or 1.5 (decimal hours)"


def parse_duration(raw: str) -> int:
    """Read a duration as minutes.

    Exactly two forms are accepted: ``1:40`` meaning hours:minutes, and ``1.5``
    meaning decimal hours. A bare number is always hours, so ``2`` is two
    hours. Suffixes like ``90m`` are refused rather than guessed at — reading
    it as 90 hours would be a silent, expensive mistake.
    """
    value = raw.strip()
    if not value:
        raise ValueError("no duration given")

    if ":" in value:
        hours_part, _, minutes_part = value.partition(":")
        try:
            hours = int(hours_part) if hours_part.strip() else 0
            minutes = int(minutes_part) if minutes_part.strip() else 0
        except ValueError as exc:
            raise ValueError(f"{value!r} is not a duration; {SHAPE_HINT}") from exc
        if hours < 0 or minutes < 0:
            raise ValueError("cannot be negative")
        if minutes >= 60:
            raise ValueError("minutes must be below 60; carry them into the hours")
        return hours * 60 + minutes

    try:
        hours_decimal = float(value)
    except ValueError as exc:
        raise ValueError(f"{value!r} is not a duration; {SHAPE_HINT}") from exc

    if hours_decimal < 0:
        raise ValueError("cannot be negative")
    # Round to the minute; 1.505 hours is not a meaningful distinction.
    return round(hours_decimal * 60)


def parse_entry_date(raw: str, *, today: date) -> date:
    """Read an ISO date.

    Only ``YYYY-MM-DD`` is accepted. ``05/10/2026`` is deliberately refused
    because it means two different days either side of the Atlantic, and
    guessing wrong would silently misfile a month of work.
    """
    value = raw.strip()
    if not value:
        raise ValueError("no date given")
    try:
        parsed = date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{value!r} is not a date; use YYYY-MM-DD, e.g. 2026-10-05") from exc

    if parsed > today:
        raise ValueError("is in the future; time cannot be logged before it is spent")
    return parsed


def parse_status(raw: str) -> TimeEntryStatus:
    value = raw.strip().lower()
    if not value:
        return TimeEntryStatus.NONE
    try:
        return TimeEntryStatus(value)
    except ValueError as exc:
        allowed = ", ".join(status.value for status in TimeEntryStatus)
        raise ValueError(f"{raw.strip()!r} is not a status; use one of: {allowed}") from exc


def parse_csv(content: bytes, *, today: date) -> ParseResult:
    """Turn an uploaded CSV into entries, collecting every problem it finds."""
    result = ParseResult()

    if len(content) > MAX_BYTES:
        result.errors.append(RowError(0, "file", f"larger than {MAX_BYTES // 1024}KB"))
        return result

    try:
        # utf-8-sig strips the byte-order mark Excel writes, which would
        # otherwise turn the first header into "﻿date".
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        result.errors.append(RowError(0, "file", "is not valid UTF-8 text"))
        return result

    reader = csv.DictReader(io.StringIO(text))
    if reader.fieldnames is None:
        result.errors.append(RowError(0, "file", "is empty"))
        return result

    headers = [normalise_header(name) for name in reader.fieldnames]
    missing = [column for column in REQUIRED_COLUMNS if column not in headers]
    if missing:
        result.errors.append(RowError(1, "header", f"missing column(s): {', '.join(missing)}"))
        return result

    for index, raw_row in enumerate(reader, start=2):  # row 1 is the header
        if len(result.entries) + len(result.errors) >= MAX_ROWS:
            result.errors.append(RowError(index, "file", f"more than {MAX_ROWS} rows"))
            break

        row = {
            normalise_header(key): (value or "")
            for key, value in raw_row.items()
            if key is not None
        }
        # Skip blank lines rather than complaining about them.
        if not any(value.strip() for value in row.values()):
            continue

        row_errors: list[RowError] = []

        try:
            entry_date = parse_entry_date(row.get("date", ""), today=today)
        except ValueError as exc:
            row_errors.append(RowError(index, "date", str(exc)))
            entry_date = today

        try:
            minutes = parse_duration(row.get("logged_hours", ""))
            if minutes <= 0:
                row_errors.append(RowError(index, "logged_hours", "must be more than zero"))
            elif minutes > MAX_MINUTES_PER_ENTRY:
                row_errors.append(RowError(index, "logged_hours", "is longer than 24 hours"))
        except ValueError as exc:
            row_errors.append(RowError(index, "logged_hours", str(exc)))
            minutes = 0

        try:
            status = parse_status(row.get("status", ""))
        except ValueError as exc:
            row_errors.append(RowError(index, "status", str(exc)))
            status = TimeEntryStatus.NONE

        description = row.get("description", "").strip() or None

        if row_errors:
            result.errors.extend(row_errors)
        else:
            result.entries.append(
                ParsedEntry(
                    row=index,
                    entry_date=entry_date,
                    logged_minutes=minutes,
                    description=description,
                    status=status,
                )
            )

    if not result.entries and not result.errors:
        result.errors.append(RowError(0, "file", "contains no rows"))

    return result


def fingerprint(entry: ParsedEntry) -> tuple[date, int, str | None, str]:
    """Identify an entry for duplicate detection."""
    return (entry.entry_date, entry.logged_minutes, entry.description, entry.status.value)
