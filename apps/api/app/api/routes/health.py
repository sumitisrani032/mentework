from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(tags=["health"])


class HealthResponse(BaseModel):
    status: str
    environment: str


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def read_health() -> HealthResponse:
    """Report that the API process is up. Does not touch the database."""
    settings = get_settings()
    return HealthResponse(status="ok", environment=settings.environment)
