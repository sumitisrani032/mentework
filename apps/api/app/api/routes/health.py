from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.session import get_db

router = APIRouter(tags=["health"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


class HealthResponse(BaseModel):
    status: str
    environment: str


class ReadinessResponse(BaseModel):
    status: str
    database: str


@router.get("/health", response_model=HealthResponse, summary="Liveness probe")
async def read_health() -> HealthResponse:
    """Report that the API process is up. Does not touch the database."""
    settings = get_settings()
    return HealthResponse(status="ok", environment=settings.environment)


@router.get("/health/db", response_model=ReadinessResponse, summary="Readiness probe")
async def read_db_health(db: DbSession) -> ReadinessResponse:
    """Verify the API can reach PostgreSQL."""
    try:
        await db.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="database unavailable",
        ) from exc
    return ReadinessResponse(status="ok", database="connected")
