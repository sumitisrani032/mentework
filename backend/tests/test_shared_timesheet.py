"""A project timesheet is shared: everyone on the project sees the whole team's time."""

import httpx
import pytest

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role


@pytest.fixture
async def team(organization, project, seeded_roles, make_user):
    """A manager and two members, all on the same project."""
    return {
        "manager": await make_user(
            organization,
            "bruno@acme.test",
            role=seeded_roles["project-manager"],
            project_id=project.id,
        ),
        "dara": await make_user(
            organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
        ),
        "chen": await make_user(
            organization, "chen@acme.test", role=seeded_roles["member"], project_id=project.id
        ),
    }


def base(project: Project) -> str:
    return f"/api/v1/projects/{project.id}/timesheets"


async def test_every_member_sees_the_whole_teams_time(
    api_client: httpx.AsyncClient, project: Project, team, auth_headers
) -> None:
    """Ten people on a project should all see one shared listing."""
    manager_headers = await auth_headers(team["manager"])
    sheet = (
        await api_client.post(base(project), json={"title": "June"}, headers=manager_headers)
    ).json()

    for person, hours in [("dara", 8), ("chen", 6), ("manager", 4)]:
        posted = await api_client.post(
            f"{base(project)}/{sheet['id']}/time",
            json={"date": "2026-08-03", "logged_hours": hours, "description": f"{person} work"},
            headers=await auth_headers(team[person]),
        )
        assert posted.status_code == 201

    # Read it back as an ordinary member, not the manager.
    listed = await api_client.get(
        f"{base(project)}/{sheet['id']}/time", headers=await auth_headers(team["dara"])
    )

    assert listed.status_code == 200
    entries = listed.json()
    assert len(entries) == 3
    assert {entry["logged_by"]["full_name"] for entry in entries} == {"Bruno", "Dara", "Chen"}
    # Only her own row is flagged as hers.
    assert sum(1 for entry in entries if entry["by_me"]) == 1


async def test_each_entry_says_who_logged_it(
    api_client: httpx.AsyncClient, project: Project, team, auth_headers
) -> None:
    dara_headers = await auth_headers(team["dara"])
    # The manager sets the timesheet up; Dara only fills it in.
    sheet = (
        await api_client.post(
            base(project), json={"title": "June"}, headers=await auth_headers(team["manager"])
        )
    ).json()
    await api_client.post(
        f"{base(project)}/{sheet['id']}/time",
        json={"date": "2026-08-03", "logged_hours": 8},
        headers=dara_headers,
    )

    entry = (
        await api_client.get(f"{base(project)}/{sheet['id']}/time", headers=dara_headers)
    ).json()[0]

    assert entry["logged_by"]["id"] == team["dara"].id
    assert entry["logged_by"]["initials"]


async def test_someone_outside_the_project_sees_none_of_it(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    team,
    make_user,
    auth_headers,
) -> None:
    """Sharing stops at the project boundary."""
    manager_headers = await auth_headers(team["manager"])
    sheet = (
        await api_client.post(base(project), json={"title": "June"}, headers=manager_headers)
    ).json()

    outsider = await make_user(organization, "eli@acme.test")
    response = await api_client.get(
        f"{base(project)}/{sheet['id']}/time", headers=await auth_headers(outsider)
    )

    assert response.status_code == 403


async def test_the_summary_splits_billable_billed_and_unmarked(
    api_client: httpx.AsyncClient, project: Project, team, auth_headers
) -> None:
    headers = await auth_headers(team["manager"])
    sheet = (
        await api_client.post(
            base(project), json={"title": "June", "estimated_hours": 40}, headers=headers
        )
    ).json()

    for hours, entry_status in [(2, "billable"), (3, "billed"), (1, "none")]:
        await api_client.post(
            f"{base(project)}/{sheet['id']}/time",
            json={"date": "2026-08-03", "logged_hours": hours, "status": entry_status},
            headers=headers,
        )

    body = (await api_client.get(f"{base(project)}/{sheet['id']}", headers=headers)).json()

    assert body["estimated_hours"] == 40
    assert body["logged_hours"] == 6
    assert body["billable_hours"] == 2
    assert body["billed_hours"] == 3
    # Everything logged that carries no billing status.
    assert body["non_billable_hours"] == 1
