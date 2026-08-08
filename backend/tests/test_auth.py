import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    InvalidToken,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.models.organization import Organization
from app.models.user import User

PASSWORD = "correct horse battery staple"


async def make_user(
    session: AsyncSession,
    organization: Organization,
    email: str = "ada@acme.test",
    *,
    password: str | None = PASSWORD,
    is_active: bool = True,
) -> User:
    user = User(
        organization_id=organization.id,
        email=email,
        full_name="Ada Okonkwo",
        hashed_password=hash_password(password) if password else None,
        is_active=is_active,
    )
    session.add(user)
    await session.flush()
    return user


async def login(client: httpx.AsyncClient, slug: str, email: str, password: str):
    return await client.post(
        "/api/v1/auth/login",
        json={"organization_slug": slug, "email": email, "password": password},
    )


# --- Password hashing -------------------------------------------------------


def test_passwords_are_hashed_with_argon2() -> None:
    digest = hash_password(PASSWORD)
    assert digest.startswith("$argon2id$")
    assert PASSWORD not in digest


def test_the_same_password_hashes_differently_each_time() -> None:
    # Distinct salts, so identical passwords are not detectable in the table.
    assert hash_password(PASSWORD) != hash_password(PASSWORD)


def test_verifying_an_account_without_a_password_fails() -> None:
    is_valid, _ = verify_password(PASSWORD, None)
    assert is_valid is False


# --- Tokens -----------------------------------------------------------------


def test_a_token_round_trips(organization: Organization) -> None:
    user_id = 4242
    token = create_access_token(
        user_id=user_id, organization_id=organization.id, slug=organization.slug
    )
    payload = decode_access_token(token)

    assert payload["sub"] == str(user_id)
    assert payload["org"] == str(organization.id)


def test_a_tampered_token_is_rejected(organization: Organization) -> None:
    token = create_access_token(
        user_id=4242, organization_id=organization.id, slug=organization.slug
    )
    head, payload, signature = token.split(".")

    with pytest.raises(InvalidToken):
        decode_access_token(f"{head}.{payload}.{signature[:-2]}xx")


# --- Sign in ----------------------------------------------------------------


async def test_a_user_can_sign_in_to_their_workspace(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await make_user(db_session, organization)

    response = await login(api_client, organization.slug, "ada@acme.test", PASSWORD)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["organization"]["slug"] == organization.slug
    assert body["user"]["email"] == "ada@acme.test"
    assert decode_access_token(body["access_token"])["org"] == str(organization.id)


async def test_the_email_is_not_case_sensitive(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await make_user(db_session, organization)

    response = await login(api_client, organization.slug, "Ada@Acme.Test", PASSWORD)

    assert response.status_code == 200


async def test_a_wrong_password_is_rejected(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await make_user(db_session, organization)

    response = await login(api_client, organization.slug, "ada@acme.test", "wrong")

    assert response.status_code == 401


async def test_an_unknown_workspace_looks_the_same_as_a_wrong_password(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await make_user(db_session, organization)

    unknown_tenant = await login(api_client, "no-such-tenant", "ada@acme.test", PASSWORD)
    unknown_email = await login(api_client, organization.slug, "nobody@acme.test", PASSWORD)
    wrong_password = await login(api_client, organization.slug, "ada@acme.test", "wrong")

    # Identical responses, so nothing about who exists can be enumerated.
    assert unknown_tenant.status_code == unknown_email.status_code == 401
    assert unknown_tenant.json() == unknown_email.json() == wrong_password.json()


async def test_a_deactivated_user_cannot_sign_in(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    await make_user(db_session, organization, is_active=False)

    response = await login(api_client, organization.slug, "ada@acme.test", PASSWORD)

    assert response.status_code == 401


async def test_a_user_cannot_sign_in_on_another_tenants_subdomain(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    """The whole point of per-subdomain sign-in."""
    other = Organization(name="Northwind", slug="northwind")
    db_session.add(other)
    await db_session.flush()
    await make_user(db_session, organization)

    response = await login(api_client, other.slug, "ada@acme.test", PASSWORD)

    assert response.status_code == 401


async def test_signing_in_records_the_time(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    user = await make_user(db_session, organization)
    assert user.last_login_at is None

    await login(api_client, organization.slug, "ada@acme.test", PASSWORD)

    await db_session.refresh(user)
    assert user.last_login_at is not None


# --- The signed-in user -----------------------------------------------------


async def test_me_requires_a_token(api_client: httpx.AsyncClient) -> None:
    response = await api_client.get("/api/v1/auth/me")

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


async def test_me_returns_roles_and_permissions(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    from app.services.rbac import assign_role, list_roles, seed_default_roles

    user = await make_user(db_session, organization)
    await seed_default_roles(db_session, organization)
    roles = {role.slug: role for role in await list_roles(db_session, organization.id)}
    await assign_role(db_session, user_id=user.id, role=roles["organization-admin"])

    signed_in = await login(api_client, organization.slug, "ada@acme.test", PASSWORD)
    token = signed_in.json()["access_token"]

    response = await api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 200
    body = response.json()
    assert body["roles"] == ["Organization Admin"]
    assert all(grant["can_view"] for grant in body["permissions"])


async def test_a_token_from_one_tenant_is_useless_against_another(
    api_client: httpx.AsyncClient, db_session: AsyncSession, organization: Organization
) -> None:
    """A forged 'org' claim must not grant access to someone else's data."""
    other = Organization(name="Northwind", slug="northwind")
    db_session.add(other)
    await db_session.flush()
    user = await make_user(db_session, organization)

    # A token claiming this user belongs to the other organization.
    token = create_access_token(user_id=user.id, organization_id=other.id, slug=other.slug)

    response = await api_client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})

    assert response.status_code == 401


async def test_the_sign_in_page_can_look_up_its_workspace(
    api_client: httpx.AsyncClient, organization: Organization
) -> None:
    response = await api_client.get(f"/api/v1/auth/organizations/{organization.slug}")

    assert response.status_code == 200
    assert response.json() == {"name": organization.name, "slug": organization.slug}


async def test_an_unknown_workspace_has_no_sign_in_page(api_client: httpx.AsyncClient) -> None:
    response = await api_client.get("/api/v1/auth/organizations/no-such-tenant")

    assert response.status_code == 404
