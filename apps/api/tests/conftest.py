from collections.abc import AsyncGenerator

import httpx
import pytest

from app.main import app


@pytest.fixture
async def client() -> AsyncGenerator[httpx.AsyncClient, None]:
    """An HTTP client bound to the ASGI app, without binding a real port."""
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as async_client:
        yield async_client
