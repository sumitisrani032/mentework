from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.session import get_db
from app.main import app
from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Role
from app.models.user import User
from app.services.rbac import assign_role, list_roles, seed_default_roles


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """An HTTP client bound to the ASGI app, without binding a real port."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


@pytest.fixture
async def api_client(db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    """A client whose requests run on the test's transaction.

    Overriding get_db means anything a route commits is rolled back with the
    rest of the test, so API tests share the development database safely.
    """
    app.dependency_overrides[get_db] = lambda: db_session
    transport = httpx.ASGITransport(app=app)
    try:
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
            yield async_client
    finally:
        app.dependency_overrides.pop(get_db, None)


@pytest.fixture
async def db_engine() -> AsyncGenerator[AsyncEngine, None]:
    """A throwaway engine per test.

    The application engine is created once at import time and pools its
    connections. pytest-asyncio runs each test in its own event loop, and an
    asyncpg connection cannot move between loops, so tests get their own engine
    with pooling disabled instead.
    """
    engine = create_async_engine(get_settings().database_url, poolclass=NullPool)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def db_session(db_engine: AsyncEngine) -> AsyncGenerator[AsyncSession, None]:
    """A session whose work is rolled back when the test finishes.

    The test runs inside an outer transaction that is never committed, so tests
    can use the development database without leaving rows behind.
    ``create_savepoint`` means a commit inside the test releases a savepoint
    rather than ending that outer transaction.
    """
    connection = await db_engine.connect()
    transaction = await connection.begin()
    session = AsyncSession(
        bind=connection,
        expire_on_commit=False,
        join_transaction_mode="create_savepoint",
    )
    try:
        yield session
    finally:
        await session.close()
        await transaction.rollback()
        await connection.close()


@pytest.fixture
async def organization(db_session: AsyncSession) -> Organization:
    org = Organization(name="Acme Design", slug="acme-design")
    db_session.add(org)
    await db_session.flush()
    return org


@pytest.fixture
async def seeded_roles(db_session: AsyncSession, organization: Organization) -> dict[str, Role]:
    """The six built-in roles for the test organization, keyed by slug."""
    await seed_default_roles(db_session, organization)
    return {role.slug: role for role in await list_roles(db_session, organization.id)}


@pytest.fixture
async def project(db_session: AsyncSession, organization: Organization) -> Project:
    item = Project(organization_id=organization.id, name="Website Relaunch", key="WEB")
    db_session.add(item)
    await db_session.flush()
    return item


@pytest.fixture
def make_user(db_session: AsyncSession):
    """Create a user, optionally granting them a role."""

    async def _make(
        organization: Organization,
        email: str,
        *,
        role: Role | None = None,
        project_id: int | None = None,
    ) -> User:
        user = User(
            organization_id=organization.id,
            email=email,
            full_name=email.split("@")[0].title(),
        )
        db_session.add(user)
        await db_session.flush()
        if role is not None:
            await assign_role(db_session, user_id=user.id, role=role, project_id=project_id)
        return user

    return _make


@pytest.fixture
def auth_headers(db_session: AsyncSession):
    """Bearer headers for a user, as if they had just signed in."""

    async def _headers(user: User) -> dict[str, str]:
        organization = await db_session.get(Organization, user.organization_id)
        assert organization is not None
        token = create_access_token(
            user_id=user.id, organization_id=organization.id, slug=organization.slug
        )
        return {"Authorization": f"Bearer {token}"}

    return _headers
