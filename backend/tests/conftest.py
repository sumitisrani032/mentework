from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.core.config import get_settings
from app.main import app
from app.models.organization import Organization


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """An HTTP client bound to the ASGI app, without binding a real port."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client


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
