"""Creating people, which only a role with the members permission may do."""

import httpx
import pytest

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role


@pytest.fixture
async def admin(organization: Organization, seeded_roles: dict[str, Role], make_user):
    return await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])


def member_payload(**overrides) -> dict:
    payload = {
        "email": "New.Person@acme.test",
        "full_name": "New Person",
        "password": "first-password",
    }
    payload.update(overrides)
    return payload


async def test_an_admin_creates_someone_with_a_role(
    api_client: httpx.AsyncClient, admin, seeded_roles: dict[str, Role], auth_headers
) -> None:
    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(seeded_roles["organization-admin"].id)),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "new.person@acme.test"  # stored lowercased
    assert [
        {key: grant[key] for key in ("role", "scope", "project")} for grant in body["roles"]
    ] == [{"role": "Organization Admin", "scope": "organization", "project": None}]


async def test_the_new_account_can_sign_in(
    api_client: httpx.AsyncClient,
    organization: Organization,
    admin,
    seeded_roles: dict[str, Role],
    auth_headers,
) -> None:
    created = await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(seeded_roles["organization-admin"].id)),
        headers=await auth_headers(admin),
    )
    assert created.status_code == 201

    signed_in = await api_client.post(
        "/api/v1/auth/login",
        json={
            "organization_slug": organization.slug,
            "email": "new.person@acme.test",
            "password": "first-password",
        },
    )

    assert signed_in.status_code == 200
    assert signed_in.json()["user"]["full_name"] == "New Person"


async def test_a_project_role_needs_a_project(
    api_client: httpx.AsyncClient,
    project: Project,
    admin,
    seeded_roles: dict[str, Role],
    auth_headers,
) -> None:
    headers = await auth_headers(admin)

    with_project = await api_client.post(
        "/api/v1/users",
        json=member_payload(
            email="dara@acme.test",
            role_id=str(seeded_roles["member"].id),
            project_ids=[str(project.id)],
        ),
        headers=headers,
    )
    assert with_project.status_code == 201
    assert [
        {key: grant[key] for key in ("role", "scope", "project")}
        for grant in with_project.json()["roles"]
    ] == [{"role": "Member", "scope": "project", "project": "Website Relaunch"}]

    # Rejected last: the failure rolls its transaction back, which would take
    # the fixtures created alongside it in this test with it.
    without = await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(seeded_roles["member"].id)),
        headers=headers,
    )
    assert without.status_code == 400


async def test_one_role_can_cover_several_projects(
    api_client: httpx.AsyncClient,
    db_session,
    organization: Organization,
    project: Project,
    admin,
    seeded_roles: dict[str, Role],
    auth_headers,
) -> None:
    """Someone is rarely on exactly one project, so the role is granted on each."""
    second = Project(organization_id=organization.id, name="Mobile App", key="MOB")
    db_session.add(second)
    await db_session.flush()

    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(
            role_id=str(seeded_roles["member"].id),
            project_ids=[str(project.id), str(second.id)],
        ),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 201
    assert {grant["project"] for grant in response.json()["roles"]} == {
        "Website Relaunch",
        "Mobile App",
    }


async def test_the_same_project_twice_is_not_an_error(
    api_client: httpx.AsyncClient,
    project: Project,
    admin,
    seeded_roles: dict[str, Role],
    auth_headers,
) -> None:
    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(
            role_id=str(seeded_roles["member"].id),
            project_ids=[str(project.id), str(project.id)],
        ),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 201
    assert len(response.json()["roles"]) == 1


async def test_an_organization_role_cannot_name_projects(
    api_client: httpx.AsyncClient,
    project: Project,
    admin,
    seeded_roles: dict[str, Role],
    auth_headers,
) -> None:
    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(
            role_id=str(seeded_roles["organization-admin"].id),
            project_ids=[str(project.id)],
        ),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 400


async def test_the_address_must_be_free_within_the_organization(
    api_client: httpx.AsyncClient, admin, seeded_roles: dict[str, Role], auth_headers
) -> None:
    headers = await auth_headers(admin)
    payload = member_payload(role_id=str(seeded_roles["organization-admin"].id))

    assert (
        await api_client.post("/api/v1/users", json=payload, headers=headers)
    ).status_code == 201
    again = await api_client.post("/api/v1/users", json=payload, headers=headers)

    assert again.status_code == 409


async def test_a_member_cannot_create_people(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    ordinary = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(seeded_roles["member"].id)),
        headers=await auth_headers(ordinary),
    )

    assert response.status_code == 403


async def test_a_role_from_another_organization_is_not_found(
    api_client: httpx.AsyncClient, db_session, admin, auth_headers
) -> None:
    other = Organization(name="Other Co", slug="other-co")
    db_session.add(other)
    await db_session.flush()
    from app.services.rbac import list_roles, seed_default_roles

    await seed_default_roles(db_session, other)
    stranger = (await list_roles(db_session, other.id))[0]

    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(stranger.id)),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 404


async def test_members_are_listed_with_their_roles(
    api_client: httpx.AsyncClient, admin, seeded_roles: dict[str, Role], auth_headers
) -> None:
    headers = await auth_headers(admin)
    await api_client.post(
        "/api/v1/users",
        json=member_payload(role_id=str(seeded_roles["organization-admin"].id)),
        headers=headers,
    )

    listed = await api_client.get("/api/v1/users", headers=headers)

    assert listed.status_code == 200
    people = listed.json()
    assert {person["email"] for person in people} == {"ada@acme.test", "new.person@acme.test"}


async def test_a_malformed_address_is_rejected(
    api_client: httpx.AsyncClient, admin, seeded_roles: dict[str, Role], auth_headers
) -> None:
    response = await api_client.post(
        "/api/v1/users",
        json=member_payload(email="not-an-address", role_id=str(seeded_roles["member"].id)),
        headers=await auth_headers(admin),
    )

    assert response.status_code == 422


# --- Taking someone out of the workspace ------------------------------------


@pytest.fixture
async def colleague(organization: Organization, project: Project, seeded_roles, make_user):
    return await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )


async def test_deactivating_someone_ends_their_access(
    api_client: httpx.AsyncClient,
    organization: Organization,
    admin,
    colleague,
    auth_headers,
) -> None:
    their_headers = await auth_headers(colleague)
    assert (await api_client.get("/api/v1/auth/me", headers=their_headers)).status_code == 200

    response = await api_client.patch(
        f"/api/v1/users/{colleague.id}",
        json={"is_active": False},
        headers=await auth_headers(admin),
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    # The token is checked against the account on every request, so it stops here.
    assert (await api_client.get("/api/v1/auth/me", headers=their_headers)).status_code == 401
    signed_in = await api_client.post(
        "/api/v1/auth/login",
        json={
            "organization_slug": organization.slug,
            "email": "dara@acme.test",
            "password": "whatever",
        },
    )
    assert signed_in.status_code == 401


async def test_someone_deactivated_can_be_restored(
    api_client: httpx.AsyncClient, admin, colleague, auth_headers
) -> None:
    headers = await auth_headers(admin)
    await api_client.patch(
        f"/api/v1/users/{colleague.id}", json={"is_active": False}, headers=headers
    )

    restored = await api_client.patch(
        f"/api/v1/users/{colleague.id}", json={"is_active": True}, headers=headers
    )

    assert restored.status_code == 200
    assert restored.json()["is_active"] is True
    assert (
        await api_client.get("/api/v1/auth/me", headers=await auth_headers(colleague))
    ).status_code == 200


async def test_their_logged_time_survives_deactivation(
    api_client: httpx.AsyncClient, project: Project, admin, colleague, auth_headers
) -> None:
    """Why this is deactivation and not deletion: the entry keeps its author."""
    admin_headers = await auth_headers(admin)
    sheet = (
        await api_client.post(
            f"/api/v1/projects/{project.id}/timesheets",
            json={"title": "August"},
            headers=admin_headers,
        )
    ).json()
    await api_client.post(
        f"/api/v1/projects/{project.id}/timesheets/{sheet['id']}/time",
        json={"date": "2026-08-03", "logged_hours": 3},
        headers=await auth_headers(colleague),
    )

    await api_client.patch(
        f"/api/v1/users/{colleague.id}", json={"is_active": False}, headers=admin_headers
    )

    entries = (
        await api_client.get(
            f"/api/v1/projects/{project.id}/timesheets/{sheet['id']}/time", headers=admin_headers
        )
    ).json()
    assert [entry["logged_by"]["full_name"] for entry in entries] == ["Dara"]


async def test_you_cannot_deactivate_yourself(
    api_client: httpx.AsyncClient, admin, auth_headers
) -> None:
    response = await api_client.patch(
        f"/api/v1/users/{admin.id}", json={"is_active": False}, headers=await auth_headers(admin)
    )

    assert response.status_code == 400
    assert "your own account" in response.json()["detail"]


async def test_the_last_role_manager_cannot_be_deactivated(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles,
    make_user,
    auth_headers,
) -> None:
    keeper = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])
    second = await make_user(organization, "zoe@acme.test", role=seeded_roles["organization-admin"])

    # Two admins: either may be deactivated by the other.
    removed = await api_client.patch(
        f"/api/v1/users/{second.id}", json={"is_active": False}, headers=await auth_headers(keeper)
    )
    assert removed.status_code == 200

    # One left, and now nobody may take the last one out.
    response = await api_client.patch(
        f"/api/v1/users/{keeper.id}", json={"is_active": False}, headers=await auth_headers(second)
    )
    assert response.status_code in (400, 401)


async def test_removing_people_needs_the_delete_permission(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles,
    make_user,
    colleague,
    auth_headers,
) -> None:
    """Project Manager may add people but not take them out."""
    manager = await make_user(
        organization, "bruno@acme.test", role=seeded_roles["project-manager"], project_id=project.id
    )

    response = await api_client.patch(
        f"/api/v1/users/{colleague.id}",
        json={"is_active": False},
        headers=await auth_headers(manager),
    )

    assert response.status_code == 403
