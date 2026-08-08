import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role


async def test_a_user_sees_only_the_projects_they_have_a_role_on(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    other = Project(organization_id=organization.id, name="Mobile App", key="MOB")
    db_session.add(other)
    await db_session.flush()

    member = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.get("/api/v1/projects", headers=await auth_headers(member))

    assert response.status_code == 200
    assert [item["key"] for item in response.json()] == ["WEB"]


async def test_an_organization_wide_role_sees_every_project(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    db_session.add(Project(organization_id=organization.id, name="Mobile App", key="MOB"))
    await db_session.flush()
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    response = await api_client.get("/api/v1/projects", headers=await auth_headers(admin))

    assert {item["key"] for item in response.json()} == {"WEB", "MOB"}


async def test_a_user_with_no_roles_sees_no_projects(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    make_user,
    auth_headers,
) -> None:
    nobody = await make_user(organization, "new@acme.test")

    response = await api_client.get("/api/v1/projects", headers=await auth_headers(nobody))

    assert response.json() == []


async def test_project_permissions_describe_what_the_caller_may_do(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    member = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.get(
        f"/api/v1/projects/{project.id}/permissions", headers=await auth_headers(member)
    )

    assert response.status_code == 200
    body = response.json()
    # Member may log time but not manage roles.
    assert body["timesheet"]["create"] is True
    assert body["roles"]["view"] is False


async def test_project_permissions_are_refused_on_another_tenants_project(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    other_org = Organization(name="Northwind", slug="northwind")
    db_session.add(other_org)
    await db_session.flush()
    theirs = Project(organization_id=other_org.id, name="Secret", key="SEC")
    db_session.add(theirs)
    await db_session.flush()

    member = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.get(
        f"/api/v1/projects/{theirs.id}/permissions", headers=await auth_headers(member)
    )

    assert response.status_code == 404
