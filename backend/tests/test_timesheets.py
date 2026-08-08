import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role
from app.services.timesheets import split_minutes, to_minutes


def url(project: Project, *parts: int | str) -> str:
    return "/".join([f"/api/v1/projects/{project.id}/timesheets", *map(str, parts)])


@pytest.fixture
async def manager(organization, project, seeded_roles, make_user):
    return await make_user(
        organization, "bruno@acme.test", role=seeded_roles["project-manager"], project_id=project.id
    )


@pytest.fixture
async def member(organization, project, seeded_roles, make_user):
    return await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )


# --- Minute arithmetic ------------------------------------------------------


@pytest.mark.parametrize(
    ("hours", "mins", "expected"),
    [(1, 40, 100), (None, 30, 30), (2, None, 120), (None, None, None), (0, 0, 0)],
)
def test_hours_and_minutes_collapse_to_a_total(hours, mins, expected) -> None:
    assert to_minutes(hours, mins) == expected


@pytest.mark.parametrize(("total", "expected"), [(100, (1, 40)), (0, (0, 0)), (None, (None, None))])
def test_a_total_splits_back_into_hours_and_minutes(total, expected) -> None:
    assert split_minutes(total) == expected


# --- Creating and reading ---------------------------------------------------


async def test_a_manager_can_create_a_timesheet(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    response = await api_client.post(
        url(project),
        json={"title": "Prepare training material", "estimated_hours": 100},
        headers=await auth_headers(manager),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Prepare training material"
    assert body["estimated_hours"] == 100
    assert body["estimated_mins"] == 0
    # Nothing logged yet.
    assert body["logged_hours"] == 0
    assert body["by_me"] is True


async def test_totals_are_summed_from_the_entries(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    headers = await auth_headers(manager)
    sheet = (
        await api_client.post(url(project), json={"title": "Research"}, headers=headers)
    ).json()

    for hours, mins, status in [(2, 30, "billable"), (1, 20, "none"), (0, 45, "billed")]:
        created = await api_client.post(
            url(project, sheet["id"], "time"),
            json={
                "date": "2026-10-05",
                "logged_hours": hours,
                "logged_mins": mins,
                "status": status,
            },
            headers=headers,
        )
        assert created.status_code == 201

    body = (await api_client.get(url(project, sheet["id"]), headers=headers)).json()

    # 2h30 + 1h20 + 45m = 4h35
    assert (body["logged_hours"], body["logged_mins"]) == (4, 35)
    assert (body["billable_hours"], body["billable_mins"]) == (2, 30)
    assert (body["billed_hours"], body["billed_mins"]) == (0, 45)


async def test_an_entry_must_log_some_time(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    headers = await auth_headers(manager)
    sheet = (
        await api_client.post(url(project), json={"title": "Research"}, headers=headers)
    ).json()

    response = await api_client.post(
        url(project, sheet["id"], "time"),
        json={"date": "2026-10-05", "logged_hours": 0, "logged_mins": 0},
        headers=headers,
    )

    assert response.status_code == 422


async def test_minutes_above_fifty_nine_are_rejected(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    """90 minutes must be sent as 1h30, so totals cannot be ambiguous."""
    headers = await auth_headers(manager)
    sheet = (
        await api_client.post(url(project), json={"title": "Research"}, headers=headers)
    ).json()

    response = await api_client.post(
        url(project, sheet["id"], "time"),
        json={"date": "2026-10-05", "logged_mins": 90},
        headers=headers,
    )

    assert response.status_code == 422


async def test_a_time_entry_carries_its_project_and_timesheet(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    headers = await auth_headers(manager)
    sheet = (
        await api_client.post(
            url(project), json={"title": "Prepare training material"}, headers=headers
        )
    ).json()
    await api_client.post(
        url(project, sheet["id"], "time"),
        json={
            "date": "2026-10-05",
            "logged_hours": 2,
            "logged_mins": 30,
            "status": "billable",
            "description": "Brainstorm session with potential users",
        },
        headers=headers,
    )

    entries = (await api_client.get(url(project, sheet["id"], "time"), headers=headers)).json()

    assert len(entries) == 1
    entry = entries[0]
    assert entry["project"]["name"] == project.name
    assert entry["timesheet"]["title"] == "Prepare training material"
    assert entry["description"] == "Brainstorm session with potential users"
    assert entry["task"] is None
    assert entry["by_me"] is True


# --- Authorization ----------------------------------------------------------


async def test_timesheets_reject_anonymous_callers(
    api_client: httpx.AsyncClient, project: Project
) -> None:
    assert (await api_client.get(url(project))).status_code == 401


async def test_a_viewer_cannot_log_time(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    """Viewer has timesheet view but no create, per the default matrix."""
    manager_headers = await auth_headers(
        await make_user(
            organization,
            "bruno@acme.test",
            role=seeded_roles["project-manager"],
            project_id=project.id,
        )
    )
    sheet = (
        await api_client.post(url(project), json={"title": "Research"}, headers=manager_headers)
    ).json()

    viewer = await make_user(
        organization, "gita@acme.test", role=seeded_roles["viewer"], project_id=project.id
    )
    response = await api_client.post(
        url(project, sheet["id"], "time"),
        json={"date": "2026-10-05", "logged_hours": 1},
        headers=await auth_headers(viewer),
    )

    assert response.status_code == 403


async def test_a_role_on_one_project_grants_nothing_on_another(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    """The point of project-scoped roles."""
    other = Project(organization_id=organization.id, name="Mobile App", key="MOB")
    db_session.add(other)
    await db_session.flush()

    manager = await make_user(
        organization, "bruno@acme.test", role=seeded_roles["project-manager"], project_id=project.id
    )

    response = await api_client.get(url(other), headers=await auth_headers(manager))

    assert response.status_code == 403


async def test_another_tenants_project_is_reported_missing(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    outsider_org = Organization(name="Northwind", slug="northwind")
    db_session.add(outsider_org)
    await db_session.flush()
    their_project = Project(organization_id=outsider_org.id, name="Secret", key="SEC")
    db_session.add(their_project)
    await db_session.flush()

    manager = await make_user(
        organization, "bruno@acme.test", role=seeded_roles["project-manager"], project_id=project.id
    )

    response = await api_client.get(url(their_project), headers=await auth_headers(manager))

    assert response.status_code == 404


# --- Private timesheets -----------------------------------------------------


async def test_a_private_timesheet_is_hidden_from_others(
    api_client: httpx.AsyncClient, project: Project, manager, member, auth_headers
) -> None:
    private = (
        await api_client.post(
            url(project),
            json={"title": "Salary review time", "private": True},
            headers=await auth_headers(manager),
        )
    ).json()

    member_headers = await auth_headers(member)
    listed = (await api_client.get(url(project), headers=member_headers)).json()
    fetched = await api_client.get(url(project, private["id"]), headers=member_headers)

    assert listed == []
    # 404 rather than 403, so its existence is not confirmed.
    assert fetched.status_code == 404


async def test_an_assignee_can_see_a_private_timesheet(
    api_client: httpx.AsyncClient, project: Project, manager, member, auth_headers
) -> None:
    private = (
        await api_client.post(
            url(project),
            json={"title": "Salary review time", "private": True, "assigned": [member.id]},
            headers=await auth_headers(manager),
        )
    ).json()

    fetched = await api_client.get(url(project, private["id"]), headers=await auth_headers(member))

    assert fetched.status_code == 200
    assert fetched.json()["assigned"] == [member.id]
    # Created by the manager, not by the person reading it.
    assert fetched.json()["by_me"] is False


async def test_assignees_must_be_in_the_same_organization(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    project: Project,
    manager,
    make_user,
    auth_headers,
) -> None:
    other = Organization(name="Northwind", slug="northwind")
    db_session.add(other)
    await db_session.flush()
    outsider = await make_user(other, "mallory@northwind.test")

    response = await api_client.post(
        url(project),
        json={"title": "Research", "assigned": [outsider.id]},
        headers=await auth_headers(manager),
    )

    assert response.status_code == 400
