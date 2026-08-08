"""Editing and removing individual time entries."""

import httpx
import pytest

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role


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


def base(project: Project) -> str:
    return f"/api/v1/projects/{project.id}/timesheets"


async def setup_entry(api_client, project, headers, **overrides) -> tuple[str, str]:
    """Create a timesheet with one entry, returning both ids."""
    sheet = (await api_client.post(base(project), json={"title": "August"}, headers=headers)).json()
    payload = {
        "date": "2026-08-03",
        "logged_hours": 1,
        "logged_mins": 40,
        "status": "billable",
        "description": "Brainstorm",
    } | overrides
    entry = (
        await api_client.post(f"{base(project)}/{sheet['id']}/time", json=payload, headers=headers)
    ).json()
    return sheet["id"], entry["id"]


# --- Editing ----------------------------------------------------------------


async def test_you_can_correct_your_own_entry(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"logged_hours": 2, "logged_mins": 15, "description": "Brainstorm and notes"},
        headers=headers,
    )

    assert response.status_code == 200
    body = response.json()
    assert (body["logged_hours"], body["logged_mins"]) == (2, 15)
    assert body["description"] == "Brainstorm and notes"
    # Untouched fields keep their value.
    assert body["status"] == "billable"
    assert body["date"] == "2026-08-03"


async def test_omitting_a_field_leaves_it_alone(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}", json={"status": "billed"}, headers=headers
    )

    body = response.json()
    assert body["status"] == "billed"
    assert body["description"] == "Brainstorm"
    assert (body["logged_hours"], body["logged_mins"]) == (1, 40)


async def test_a_description_can_be_cleared_explicitly(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """Sending null differs from omitting the field."""
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}", json={"description": None}, headers=headers
    )

    assert response.json()["description"] is None


async def test_an_edit_cannot_zero_the_duration(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"logged_hours": 0, "logged_mins": 0},
        headers=headers,
    )

    assert response.status_code == 422


async def test_an_edit_cannot_move_time_into_the_future(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}", json={"date": "2099-01-01"}, headers=headers
    )

    assert response.status_code == 422


async def test_editing_changes_the_timesheet_total(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """Totals are derived, so a correction must flow through immediately."""
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"logged_hours": 3, "logged_mins": 0},
        headers=headers,
    )
    sheet = (await api_client.get(f"{base(project)}/{sheet_id}", headers=headers)).json()

    assert (sheet["logged_hours"], sheet["logged_mins"]) == (3, 0)
    assert (sheet["billable_hours"], sheet["billable_mins"]) == (3, 0)


# --- Whose entry ------------------------------------------------------------


async def test_a_member_cannot_edit_someone_elses_time(
    api_client: httpx.AsyncClient, project: Project, manager, member, auth_headers
) -> None:
    """Ordinary members must not be able to rewrite a colleague's hours."""
    manager_headers = await auth_headers(manager)
    sheet_id, entry_id = await setup_entry(api_client, project, manager_headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"logged_hours": 8},
        headers=await auth_headers(member),
    )

    assert response.status_code == 403
    assert "yourself" in response.json()["detail"]


async def test_a_manager_can_correct_anyones_time(
    api_client: httpx.AsyncClient, project: Project, manager, member, auth_headers
) -> None:
    member_headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, member_headers)

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"status": "billed"},
        headers=await auth_headers(manager),
    )

    assert response.status_code == 200
    assert response.json()["status"] == "billed"


# --- Deleting ---------------------------------------------------------------


async def test_a_member_cannot_delete_time_by_default(
    api_client: httpx.AsyncClient, project: Project, member, auth_headers
) -> None:
    """Member has timesheet edit but not delete in the default matrix."""
    headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)

    response = await api_client.delete(
        f"{base(project)}/{sheet_id}/time/{entry_id}", headers=headers
    )

    assert response.status_code == 403


async def test_a_manager_can_delete_an_entry(
    api_client: httpx.AsyncClient, project: Project, manager, member, auth_headers
) -> None:
    member_headers = await auth_headers(member)
    sheet_id, entry_id = await setup_entry(api_client, project, member_headers)
    manager_headers = await auth_headers(manager)

    response = await api_client.delete(
        f"{base(project)}/{sheet_id}/time/{entry_id}", headers=manager_headers
    )

    assert response.status_code == 204
    listed = await api_client.get(f"{base(project)}/{sheet_id}/time", headers=manager_headers)
    assert listed.json() == []


async def test_deleting_an_entry_lowers_the_total(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    headers = await auth_headers(manager)
    sheet_id, entry_id = await setup_entry(api_client, project, headers)
    await api_client.post(
        f"{base(project)}/{sheet_id}/time",
        json={"date": "2026-08-04", "logged_hours": 2},
        headers=headers,
    )

    await api_client.delete(f"{base(project)}/{sheet_id}/time/{entry_id}", headers=headers)
    sheet = (await api_client.get(f"{base(project)}/{sheet_id}", headers=headers)).json()

    assert (sheet["logged_hours"], sheet["logged_mins"]) == (2, 0)


# --- Reach ------------------------------------------------------------------


async def test_an_entry_from_another_timesheet_is_not_found(
    api_client: httpx.AsyncClient, project: Project, manager, auth_headers
) -> None:
    headers = await auth_headers(manager)
    _, entry_id = await setup_entry(api_client, project, headers)
    other_sheet = (
        await api_client.post(base(project), json={"title": "September"}, headers=headers)
    ).json()

    response = await api_client.patch(
        f"{base(project)}/{other_sheet['id']}/time/{entry_id}",
        json={"logged_hours": 5},
        headers=headers,
    )

    assert response.status_code == 404


async def test_a_viewer_cannot_edit_anything(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    manager,
    make_user,
    auth_headers,
) -> None:
    sheet_id, entry_id = await setup_entry(api_client, project, await auth_headers(manager))
    viewer = await make_user(
        organization, "gita@acme.test", role=seeded_roles["viewer"], project_id=project.id
    )

    response = await api_client.patch(
        f"{base(project)}/{sheet_id}/time/{entry_id}",
        json={"logged_hours": 5},
        headers=await auth_headers(viewer),
    )

    assert response.status_code == 403
