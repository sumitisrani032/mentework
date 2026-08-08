"""Authorization on the organization and role endpoints."""

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Feature, Role, RoleScope
from app.services.rbac import FULL, build_permission_rows

ROLES_URL = "/api/v1/roles"


# --- Nothing is reachable without signing in --------------------------------


@pytest.mark.parametrize(
    ("method", "url"),
    [
        ("get", ROLES_URL),
        ("post", ROLES_URL),
        ("get", "/api/v1/organizations/me"),
        ("get", f"/api/v1/organizations/{'0' * 8}-0000-0000-0000-000000000000"),
    ],
)
async def test_endpoints_reject_anonymous_callers(
    api_client: httpx.AsyncClient, method: str, url: str
) -> None:
    response = await getattr(api_client, method)(url, **({"json": {}} if method == "post" else {}))

    assert response.status_code == 401


# --- Permission is required, not just a session -----------------------------


async def test_a_member_cannot_read_the_role_matrix(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    """Member has no `roles` permission, so a valid session is not enough."""
    member = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.get(ROLES_URL, headers=await auth_headers(member))

    assert response.status_code == 403
    assert "roles" in response.json()["detail"]


async def test_a_user_with_no_roles_cannot_read_the_matrix(
    api_client: httpx.AsyncClient, organization: Organization, make_user, auth_headers
) -> None:
    nobody = await make_user(organization, "new@acme.test")

    response = await api_client.get(ROLES_URL, headers=await auth_headers(nobody))

    assert response.status_code == 403


async def test_a_member_cannot_create_or_delete_roles(
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
    headers = await auth_headers(member)

    created = await api_client.post(
        ROLES_URL, json={"name": "Sneaky", "scope": "project"}, headers=headers
    )
    deleted = await api_client.delete(f"{ROLES_URL}/{seeded_roles['viewer'].id}", headers=headers)

    assert created.status_code == 403
    assert deleted.status_code == 403


async def test_a_member_cannot_escalate_by_granting_themselves_a_role(
    api_client: httpx.AsyncClient,
    organization: Organization,
    project: Project,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    """The obvious privilege-escalation path must be closed."""
    member = await make_user(
        organization, "dara@acme.test", role=seeded_roles["member"], project_id=project.id
    )

    response = await api_client.post(
        f"/api/v1/users/{member.id}/roles",
        json={"role_id": str(seeded_roles["organization-admin"].id)},
        headers=await auth_headers(member),
    )

    assert response.status_code == 403


async def test_permission_follows_the_matrix_not_the_role_name(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    make_user,
    auth_headers,
) -> None:
    """Access comes from the grid, not from a role being called "admin"."""
    custom = Role(
        organization_id=organization.id,
        name="Auditor",
        slug="auditor",
        scope=RoleScope.ORGANIZATION,
        permissions=build_permission_rows({}),
    )
    db_session.add(custom)
    await db_session.flush()
    auditor = await make_user(organization, "aud@acme.test", role=custom)

    before = await api_client.get(ROLES_URL, headers=await auth_headers(auditor))
    assert before.status_code == 403

    for permission in custom.permissions:
        if permission.feature is Feature.ROLES:
            permission.can_view = True
    await db_session.flush()

    after = await api_client.get(ROLES_URL, headers=await auth_headers(auditor))
    assert after.status_code == 200


async def test_a_project_scoped_grant_cannot_confer_an_organization_feature(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    project: Project,
    make_user,
    auth_headers,
) -> None:
    """`roles` is organization-level, so a project grant must never unlock it.

    Otherwise being an admin of one project would quietly hand over the whole
    organization's role settings.
    """
    project_role = Role(
        organization_id=organization.id,
        name="Project Admin",
        slug="project-admin",
        scope=RoleScope.PROJECT,
        permissions=build_permission_rows({Feature.ROLES: FULL}),
    )
    db_session.add(project_role)
    await db_session.flush()
    user = await make_user(organization, "pa@acme.test", role=project_role, project_id=project.id)

    response = await api_client.get(ROLES_URL, headers=await auth_headers(user))

    assert response.status_code == 403


# --- One tenant cannot reach another ----------------------------------------


async def test_an_admin_cannot_edit_another_tenants_role(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    other = Organization(name="Northwind", slug="northwind")
    db_session.add(other)
    await db_session.flush()
    from app.services.rbac import list_roles, seed_default_roles

    await seed_default_roles(db_session, other)
    their_roles = {role.slug: role for role in await list_roles(db_session, other.id)}
    victim = their_roles["viewer"]

    headers = await auth_headers(admin)
    read = await api_client.put(
        f"{ROLES_URL}/{victim.id}/permissions",
        json={"permissions": [{"feature": "billing", "can_view": True, "can_delete": True}]},
        headers=headers,
    )
    removed = await api_client.delete(f"{ROLES_URL}/{victim.id}", headers=headers)

    # Reported as missing, not forbidden, so ids cannot be probed.
    assert read.status_code == 404
    assert removed.status_code == 404


async def test_reading_another_organization_reports_it_missing(
    api_client: httpx.AsyncClient,
    db_session: AsyncSession,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    other = Organization(name="Northwind", slug="northwind")
    db_session.add(other)
    await db_session.flush()

    response = await api_client.get(
        f"/api/v1/organizations/{other.id}", headers=await auth_headers(admin)
    )

    assert response.status_code == 404


async def test_anyone_signed_in_can_read_their_own_organization(
    api_client: httpx.AsyncClient, organization: Organization, make_user, auth_headers
) -> None:
    user = await make_user(organization, "dara@acme.test")

    response = await api_client.get("/api/v1/organizations/me", headers=await auth_headers(user))

    assert response.status_code == 200
    assert response.json()["slug"] == organization.slug


async def test_there_is_no_route_that_lists_every_organization(
    api_client: httpx.AsyncClient, organization: Organization, make_user, auth_headers
) -> None:
    """Enumerating tenants must not be possible, even signed in."""
    user = await make_user(organization, "dara@acme.test")

    response = await api_client.get("/api/v1/organizations", headers=await auth_headers(user))

    assert response.status_code in {404, 405}
