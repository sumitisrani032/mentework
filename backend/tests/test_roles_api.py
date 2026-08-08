import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.organization import Organization
from app.models.role import Feature, Role

ROLES_URL = "/api/v1/roles"


async def test_reading_the_matrix_requires_permission(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    response = await api_client.get(ROLES_URL, headers=await auth_headers(admin))

    assert response.status_code == 200
    body = response.json()
    assert len(body["features"]) == len(list(Feature))
    assert {role["slug"] for role in body["roles"]} == set(seeded_roles)


async def test_an_admin_can_retune_a_built_in_role(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])
    manager = seeded_roles["project-manager"]

    payload = {
        "permissions": [
            {
                "feature": permission.feature.value,
                "can_view": permission.can_view,
                "can_create": permission.can_create,
                "can_edit": permission.can_edit,
                "can_delete": False
                if permission.feature is Feature.TASKS
                else permission.can_delete,
            }
            for permission in manager.permissions
        ]
    }

    response = await api_client.put(
        f"{ROLES_URL}/{manager.id}/permissions", json=payload, headers=await auth_headers(admin)
    )

    assert response.status_code == 200
    tasks = next(p for p in response.json()["permissions"] if p["feature"] == "tasks")
    assert tasks["can_delete"] is False
    assert tasks["can_edit"] is True


async def test_editing_without_viewing_is_rejected(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    response = await api_client.put(
        f"{ROLES_URL}/{seeded_roles['viewer'].id}/permissions",
        json={"permissions": [{"feature": "tasks", "can_view": False, "can_create": True}]},
        headers=await auth_headers(admin),
    )

    assert response.status_code == 422


async def test_built_in_roles_cannot_be_deleted(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])

    response = await api_client.delete(
        f"{ROLES_URL}/{seeded_roles['organization-admin'].id}", headers=await auth_headers(admin)
    )

    assert response.status_code == 400
    assert "cannot be deleted" in response.json()["detail"]


async def test_a_custom_role_starts_with_no_access_and_can_be_removed(
    api_client: httpx.AsyncClient,
    organization: Organization,
    seeded_roles: dict[str, Role],
    make_user,
    auth_headers,
) -> None:
    admin = await make_user(organization, "ada@acme.test", role=seeded_roles["organization-admin"])
    headers = await auth_headers(admin)

    created = await api_client.post(
        ROLES_URL, json={"name": "QA Reviewer", "scope": "project"}, headers=headers
    )

    assert created.status_code == 201
    body = created.json()
    assert body["slug"] == "qa-reviewer"
    assert body["is_system"] is False
    assert not any(permission["can_view"] for permission in body["permissions"])

    removed = await api_client.delete(f"{ROLES_URL}/{body['id']}", headers=headers)
    assert removed.status_code == 204


async def test_granting_a_role_needs_the_user_to_be_a_colleague(
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
    outsider = await make_user(other, "mallory@northwind.test")

    response = await api_client.post(
        f"/api/v1/users/{outsider.id}/roles",
        json={"role_id": str(seeded_roles["organization-admin"].id)},
        headers=await auth_headers(admin),
    )

    assert response.status_code == 404
