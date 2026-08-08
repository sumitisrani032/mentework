import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.role import Feature
from app.services.rbac import list_roles, seed_default_roles


async def test_creating_an_organization_seeds_its_roles(api_client: httpx.AsyncClient) -> None:
    response = await api_client.post(
        "/api/v1/organizations", json={"name": "Northwind", "slug": "northwind"}
    )
    assert response.status_code == 201
    organization_id = response.json()["id"]

    matrix = await api_client.get(f"/api/v1/organizations/{organization_id}/roles")
    body = matrix.json()

    assert {role["slug"] for role in body["roles"]} == {
        "organization-admin",
        "project-manager",
        "team-lead",
        "member",
        "client",
        "viewer",
    }
    assert len(body["features"]) == len(list(Feature))
    # Every role must expose a checkbox for every feature.
    assert all(len(role["permissions"]) == len(list(Feature)) for role in body["roles"])


async def test_a_reserved_subdomain_is_rejected(api_client: httpx.AsyncClient) -> None:
    response = await api_client.post("/api/v1/organizations", json={"name": "Api", "slug": "api"})
    assert response.status_code == 422


async def test_an_admin_can_retune_a_built_in_role(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    manager = roles["project-manager"]

    payload = {
        "permissions": [
            {
                "feature": permission.feature.value,
                "can_view": permission.can_view,
                "can_create": permission.can_create,
                "can_edit": permission.can_edit,
                # Take away the ability to delete tasks.
                "can_delete": False
                if permission.feature is Feature.TASKS
                else permission.can_delete,
            }
            for permission in manager.permissions
        ]
    }

    response = await api_client.put(f"/api/v1/roles/{manager.id}/permissions", json=payload)

    assert response.status_code == 200
    tasks = next(p for p in response.json()["permissions"] if p["feature"] == "tasks")
    assert tasks["can_delete"] is False
    assert tasks["can_edit"] is True


async def test_editing_without_viewing_is_rejected(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}

    response = await api_client.put(
        f"/api/v1/roles/{roles['viewer'].id}/permissions",
        json={"permissions": [{"feature": "tasks", "can_view": False, "can_create": True}]},
    )

    assert response.status_code == 422


async def test_built_in_roles_cannot_be_deleted(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}

    response = await api_client.delete(f"/api/v1/roles/{roles['organization-admin'].id}")

    assert response.status_code == 400
    assert "cannot be deleted" in response.json()["detail"]


async def test_a_custom_role_starts_with_no_access_and_can_be_removed(
    api_client: httpx.AsyncClient, organization: Organization
) -> None:
    created = await api_client.post(
        f"/api/v1/organizations/{organization.id}/roles",
        json={"name": "QA Reviewer", "scope": "project"},
    )
    assert created.status_code == 201
    body = created.json()
    assert body["slug"] == "qa-reviewer"
    assert body["is_system"] is False
    assert not any(permission["can_view"] for permission in body["permissions"])

    assert (await api_client.delete(f"/api/v1/roles/{body['id']}")).status_code == 204
