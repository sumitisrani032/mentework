from datetime import date

import httpx
import pytest

from app.models.project import Project
from app.models.timesheet import TimeEntryStatus
from app.services.time_import import parse_csv, parse_duration, parse_entry_date

TODAY = date(2026, 10, 31)


def csv_bytes(body: str) -> bytes:
    return body.encode("utf-8")


def upload(body: str = "", *, name: str = "october.csv", raw: bytes | None = None):
    return {"file": (name, raw if raw is not None else csv_bytes(body), "text/csv")}


# --- Durations --------------------------------------------------------------


@pytest.mark.parametrize(
    ("raw", "minutes"),
    [("1:40", 100), ("0:30", 30), ("2", 120), ("1.5", 90), ("0.25", 15), (" 3 ", 180)],
)
def test_durations_are_read_as_hours(raw: str, minutes: int) -> None:
    assert parse_duration(raw) == minutes


@pytest.mark.parametrize("raw", ["90m", "1h40", "abc", "", "1:75", "-2", "1:-5"])
def test_ambiguous_or_broken_durations_are_refused(raw: str) -> None:
    """`90m` must not be guessed at — reading it as 90 hours would be costly."""
    with pytest.raises(ValueError):
        parse_duration(raw)


# --- Dates ------------------------------------------------------------------


def test_iso_dates_are_accepted() -> None:
    assert parse_entry_date("2026-10-05", today=TODAY) == date(2026, 10, 5)


@pytest.mark.parametrize("raw", ["05/10/2026", "10/05/2026", "5 Oct 2026", "", "2026-13-01"])
def test_ambiguous_date_formats_are_refused(raw: str) -> None:
    """05/10 means two different days depending on where you are."""
    with pytest.raises(ValueError):
        parse_entry_date(raw, today=TODAY)


def test_future_dates_are_refused() -> None:
    with pytest.raises(ValueError, match="future"):
        parse_entry_date("2026-11-01", today=TODAY)


# --- Parsing a file ---------------------------------------------------------


def test_a_good_file_parses() -> None:
    result = parse_csv(
        csv_bytes(
            "date,logged_hours,description,status\n"
            "2026-10-05,1:40,Brainstorm,billable\n"
            "2026-10-06,2.5,Emails,\n"
        ),
        today=TODAY,
    )

    assert result.ok
    assert result.total_minutes == 100 + 150
    assert result.entries[0].status is TimeEntryStatus.BILLABLE
    # A blank status falls back to "none" rather than failing the row.
    assert result.entries[1].status is TimeEntryStatus.NONE
    assert result.entries[1].description == "Emails"


def test_an_excel_byte_order_mark_does_not_break_the_header() -> None:
    """Excel writes a BOM; without handling it the first column is unreadable."""
    raw = "﻿date,logged_hours,description,status\n2026-10-05,1,Work,none\n".encode()

    result = parse_csv(raw, today=TODAY)

    assert result.ok
    assert len(result.entries) == 1


@pytest.mark.parametrize(
    "header",
    [
        "date,logged_hours,description,status",
        "Date,Logged Hours,Description,Status",
        "day,hours,notes,billing",
        "DATE,LOG_HOURS,COMMENT,STATUS",
    ],
)
def test_common_header_spellings_are_accepted(header: str) -> None:
    result = parse_csv(csv_bytes(f"{header}\n2026-10-05,1:30,Work,none\n"), today=TODAY)

    assert result.ok, result.errors


def test_blank_lines_are_ignored() -> None:
    result = parse_csv(
        csv_bytes("date,logged_hours\n2026-10-05,1\n\n,\n2026-10-06,2\n"), today=TODAY
    )

    assert result.ok
    assert len(result.entries) == 2


def test_a_missing_column_is_reported_once() -> None:
    result = parse_csv(csv_bytes("date,description\n2026-10-05,Work\n"), today=TODAY)

    assert not result.ok
    assert "logged_hours" in result.errors[0].message


def test_every_bad_row_is_reported_with_its_number() -> None:
    result = parse_csv(
        csv_bytes(
            "date,logged_hours,description,status\n"
            "2026-10-05,1:40,Fine,billable\n"
            "05/10/2026,2,Bad date,none\n"
            "2026-10-07,abc,Bad hours,none\n"
            "2026-10-08,1,Bad status,invoiced\n"
        ),
        today=TODAY,
    )

    assert not result.ok
    assert {(error.row, error.column) for error in result.errors} == {
        (3, "date"),
        (4, "logged_hours"),
        (5, "status"),
    }


def test_an_empty_file_is_reported() -> None:
    assert not parse_csv(b"", today=TODAY).ok


# --- The endpoint -----------------------------------------------------------


@pytest.fixture
async def member(organization, project, seeded_roles, make_user):
    return await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )


async def make_timesheet(api_client, project, headers) -> str:
    created = await api_client.post(
        f"/api/v1/projects/{project.id}/timesheets",
        json={"title": "October"},
        headers=headers,
    )
    return created.json()["id"]


def import_url(project: Project, timesheet_id: str) -> str:
    return f"/api/v1/projects/{project.id}/timesheets/{timesheet_id}/time/import"


async def test_a_member_can_upload_a_month_of_time(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)

    response = await api_client.post(
        import_url(project, timesheet_id),
        files=upload(
            "date,logged_hours,description,status\n"
            "2026-08-03,1:40,Brainstorm session,billable\n"
            "2026-08-04,2.5,Drafted onboarding emails,none\n"
            "2026-08-05,0:30,Standup,billed\n"
        ),
        headers=headers,
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["imported"] == 3
    # 1h40 + 2h30 + 0h30 = 4h40
    assert (body["logged_hours"], body["logged_mins"]) == (4, 40)

    listed = await api_client.get(
        f"/api/v1/projects/{project.id}/timesheets/{timesheet_id}/time", headers=headers
    )
    assert len(listed.json()) == 3


async def test_one_bad_row_rejects_the_whole_file(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """A half-imported month is worse than one that never landed."""
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)

    response = await api_client.post(
        import_url(project, timesheet_id),
        files=upload(
            "date,logged_hours,description,status\n"
            "2026-08-03,1:40,Good,billable\n"
            "2026-08-04,notanumber,Bad,none\n"
        ),
        headers=headers,
    )

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["errors"][0]["row"] == 3
    assert detail["errors"][0]["column"] == "logged_hours"

    # Nothing was written, not even the good row.
    listed = await api_client.get(
        f"/api/v1/projects/{project.id}/timesheets/{timesheet_id}/time", headers=headers
    )
    assert listed.json() == []


async def test_uploading_the_same_file_twice_does_not_double_count(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """The most common way to corrupt a month of timesheets."""
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)
    body = "date,logged_hours,description,status\n2026-08-03,1:40,Brainstorm,billable\n"

    first = await api_client.post(
        import_url(project, timesheet_id), files=upload(body), headers=headers
    )
    second = await api_client.post(
        import_url(project, timesheet_id), files=upload(body), headers=headers
    )

    assert first.json()["imported"] == 1
    assert second.json()["imported"] == 0
    assert second.json()["skipped_duplicates"] == 1

    listed = await api_client.get(
        f"/api/v1/projects/{project.id}/timesheets/{timesheet_id}/time", headers=headers
    )
    assert len(listed.json()) == 1


async def test_duplicates_can_be_forced_through(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """Genuinely repeated work must still be loggable."""
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)
    body = "date,logged_hours,description,status\n2026-08-03,1:00,Standup,none\n"

    await api_client.post(import_url(project, timesheet_id), files=upload(body), headers=headers)
    forced = await api_client.post(
        f"{import_url(project, timesheet_id)}?allow_duplicates=true",
        files=upload(body),
        headers=headers,
    )

    assert forced.json()["imported"] == 1


async def test_a_dry_run_validates_without_saving(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)

    response = await api_client.post(
        f"{import_url(project, timesheet_id)}?dry_run=true",
        files=upload("date,logged_hours\n2026-08-03,1:40\n"),
        headers=headers,
    )

    body = response.json()
    assert body["imported"] == 1
    assert body["dry_run"] is True
    assert (body["logged_hours"], body["logged_mins"]) == (1, 40)
    # A dry run returns the parsed rows so the uploader can check them.
    assert body["preview"] == [
        {
            "row": 2,
            "date": "2026-08-03",
            "logged_hours": 1,
            "logged_mins": 40,
            "description": None,
            "status": "none",
            "duplicate": False,
        }
    ]

    listed = await api_client.get(
        f"/api/v1/projects/{project.id}/timesheets/{timesheet_id}/time", headers=headers
    )
    assert listed.json() == []


async def test_a_viewer_cannot_bulk_upload(
    api_client: httpx.AsyncClient,
    organization,
    project: Project,
    seeded_roles,
    make_user,
    auth_headers,
    member,
) -> None:
    member_headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, member_headers)

    viewer = await make_user(
        organization, "gita@acme.test", role=seeded_roles["viewer"], project_id=project.id
    )
    response = await api_client.post(
        import_url(project, timesheet_id),
        files=upload("date,logged_hours\n2026-08-03,1\n"),
        headers=await auth_headers(viewer),
    )

    assert response.status_code == 403


async def test_a_dry_run_flags_rows_that_would_be_skipped(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """The preview must show duplicates, not quietly drop them."""
    headers = await auth_headers(member)
    timesheet_id = await make_timesheet(api_client, project, headers)
    body = "date,logged_hours,description,status\n2026-08-03,1:00,Standup,none\n"

    await api_client.post(import_url(project, timesheet_id), files=upload(body), headers=headers)
    preview = await api_client.post(
        f"{import_url(project, timesheet_id)}?dry_run=true",
        files=upload(body + "2026-08-04,2:00,New work,billable\n"),
        headers=headers,
    )

    rows = preview.json()["preview"]
    assert [row["duplicate"] for row in rows] == [True, False]
    assert preview.json()["imported"] == 1
    assert preview.json()["skipped_duplicates"] == 1


async def test_the_template_can_be_downloaded(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    response = await api_client.get(
        f"/api/v1/projects/{project.id}/timesheets/import-template",
        headers=await auth_headers(member),
    )

    assert response.status_code == 200
    assert response.text.splitlines()[0] == "date,logged_hours,description,status"
