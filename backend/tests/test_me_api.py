"""The signed-in user's own time, gathered from every project they can see."""

import httpx
import pytest
from sqlalchemy import delete

from app.core.security import hash_password
from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole


@pytest.fixture
async def admin(organization: Organization, seeded_roles: dict[str, Role], make_user):
    """Someone who may set a timesheet up, which the people logging time cannot."""
    return await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])


@pytest.fixture
async def second_project(db_session, organization: Organization) -> Project:
    item = Project(organization_id=organization.id, name="Mobile App", key="MOB")
    db_session.add(item)
    await db_session.flush()
    return item


def timesheets_url(project: Project) -> str:
    return f"/api/v1/projects/{project.public_id}/timesheets"


async def log_time(
    api_client: httpx.AsyncClient,
    project: Project,
    headers: dict[str, str],
    *,
    title: str,
    date: str,
    hours: int,
    sheet_headers: dict[str, str] | None = None,
) -> dict:
    """Log an hour or two, creating the timesheet as whoever may create one."""
    sheet = (
        await api_client.post(
            timesheets_url(project), json={"title": title}, headers=sheet_headers or headers
        )
    ).json()
    posted = await api_client.post(
        f"{timesheets_url(project)}/{sheet['id']}/time",
        json={"date": date, "logged_hours": hours},
        headers=headers,
    )
    assert posted.status_code == 201
    return sheet


async def test_my_time_spans_projects_newest_first(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    second_project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    user = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])
    headers = await auth_headers(user)

    await log_time(api_client, project, headers, title="August", date="2026-08-03", hours=3)
    await log_time(
        api_client, second_project, headers, title="Sprint 1", date="2026-08-05", hours=5
    )

    response = await api_client.get("/api/v1/me/time", headers=headers)

    assert response.status_code == 200
    entries = response.json()
    assert [entry["project"]["name"] for entry in entries] == ["Mobile App", "Website Relaunch"]
    assert entries[0]["timesheet"]["title"] == "Sprint 1"
    assert entries[0]["logged_hours"] == 5
    assert all(entry["by_me"] for entry in entries)


async def test_only_your_own_entries_come_back(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
    admin,
) -> None:
    """A shared timesheet shows the whole team, but "my time" is only mine."""
    mine = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )
    theirs = await make_user(
        organization, "chen@acme.test", role=seeded_roles["member"], project_id=project.id
    )
    my_headers = await auth_headers(mine)

    sheet = await log_time(
        api_client,
        project,
        my_headers,
        title="August",
        date="2026-08-03",
        hours=2,
        sheet_headers=await auth_headers(admin),
    )
    await api_client.post(
        f"{timesheets_url(project)}/{sheet['id']}/time",
        json={"date": "2026-08-04", "logged_hours": 7},
        headers=await auth_headers(theirs),
    )

    entries = (await api_client.get("/api/v1/me/time", headers=my_headers)).json()

    assert len(entries) == 1
    assert entries[0]["logged_by"]["id"] == mine.id


async def test_time_on_a_project_you_lost_access_to_is_hidden(
    api_client: httpx.AsyncClient,
    db_session,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
    admin,
) -> None:
    user = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )
    headers = await auth_headers(user)
    await log_time(
        api_client,
        project,
        headers,
        title="August",
        date="2026-08-03",
        hours=4,
        sheet_headers=await auth_headers(admin),
    )

    # Taken off the project, the time they logged goes with it.
    await db_session.execute(delete(UserRole).where(UserRole.user_id == user.id))

    entries = (await api_client.get("/api/v1/me/time", headers=headers)).json()

    assert entries == []


async def test_the_limit_caps_the_listing(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
    admin,
) -> None:
    user: User = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )
    headers = await auth_headers(user)
    sheet = await log_time(
        api_client,
        project,
        headers,
        title="August",
        date="2026-08-01",
        hours=1,
        sheet_headers=await auth_headers(admin),
    )
    for day in range(2, 6):
        await api_client.post(
            f"{timesheets_url(project)}/{sheet['id']}/time",
            json={"date": f"2026-08-0{day}", "logged_hours": 1},
            headers=headers,
        )

    entries = (await api_client.get("/api/v1/me/time?limit=2", headers=headers)).json()

    assert len(entries) == 2
    assert [entry["date"] for entry in entries] == ["2026-08-05", "2026-08-04"]


async def test_signed_out_callers_are_rejected(api_client: httpx.AsyncClient) -> None:
    assert (await api_client.get("/api/v1/me/time")).status_code == 401


async def test_you_can_rename_yourself(
    api_client: httpx.AsyncClient, organization: Organization, make_user, auth_headers
) -> None:
    user = await make_user(organization, "dara@acme.test")
    headers = await auth_headers(user)

    response = await api_client.patch(
        "/api/v1/me/profile", json={"full_name": "  Dara Nwosu  "}, headers=headers
    )

    assert response.status_code == 200
    assert response.json()["full_name"] == "Dara Nwosu"
    assert (await api_client.get("/api/v1/auth/me", headers=headers)).json()["user"][
        "full_name"
    ] == "Dara Nwosu"


async def test_your_email_is_not_yours_to_change(
    api_client: httpx.AsyncClient, organization: Organization, make_user, auth_headers
) -> None:
    """The address identifies the account, so the endpoint simply ignores it."""
    user = await make_user(organization, "dara@acme.test")
    headers = await auth_headers(user)

    response = await api_client.patch(
        "/api/v1/me/profile",
        json={"full_name": "Dara", "email": "someone.else@acme.test"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["email"] == "dara@acme.test"


async def test_changing_your_password_needs_the_current_one(
    api_client: httpx.AsyncClient,
    db_session,
    organization: Organization,
    make_user,
    auth_headers,
) -> None:
    user: User = await make_user(organization, "dara@acme.test")
    user.hashed_password = hash_password("mentework")
    await db_session.flush()
    headers = await auth_headers(user)

    wrong = await api_client.post(
        "/api/v1/me/password",
        json={"current_password": "not-it", "new_password": "a-longer-secret"},
        headers=headers,
    )
    assert wrong.status_code == 400

    changed = await api_client.post(
        "/api/v1/me/password",
        json={"current_password": "mentework", "new_password": "a-longer-secret"},
        headers=headers,
    )
    assert changed.status_code == 204

    # The new password is the one that signs in now.
    signed_in = await api_client.post(
        "/api/v1/auth/login",
        json={
            "organization_slug": organization.slug,
            "email": "dara@acme.test",
            "password": "a-longer-secret",
        },
    )
    assert signed_in.status_code == 200


async def test_a_new_password_must_be_long_enough_and_different(
    api_client: httpx.AsyncClient,
    db_session,
    organization: Organization,
    make_user,
    auth_headers,
) -> None:
    user: User = await make_user(organization, "dara@acme.test")
    user.hashed_password = hash_password("mentework")
    await db_session.flush()
    headers = await auth_headers(user)

    too_short = await api_client.post(
        "/api/v1/me/password",
        json={"current_password": "mentework", "new_password": "short"},
        headers=headers,
    )
    assert too_short.status_code == 422

    unchanged = await api_client.post(
        "/api/v1/me/password",
        json={"current_password": "mentework", "new_password": "mentework"},
        headers=headers,
    )
    assert unchanged.status_code == 400
