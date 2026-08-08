"""Organization endpoints.

NOTE: unauthenticated for now. Creating an organization will become part of
signup, and listing must be restricted once auth exists.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.organization import Organization
from app.schemas.organization import OrganizationCreate, OrganizationRead
from app.services import rbac

router = APIRouter(prefix="/organizations", tags=["organizations"])

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=list[OrganizationRead], summary="List organizations")
async def read_organizations(db: DbSession) -> list[Organization]:
    result = await db.execute(select(Organization).order_by(Organization.name))
    return list(result.scalars().all())


@router.post(
    "",
    response_model=OrganizationRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create an organization",
)
async def create_organization(payload: OrganizationCreate, db: DbSession) -> Organization:
    """Create a tenant and seed its built-in roles.

    Seeding happens in the same transaction, so an organization can never exist
    without the roles its admins need to manage it.
    """
    organization = Organization(name=payload.name.strip(), slug=payload.slug)
    db.add(organization)
    try:
        await db.flush()
        await rbac.seed_default_roles(db, organization)
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status.HTTP_409_CONFLICT, f"The subdomain {payload.slug!r} is taken"
        ) from exc

    await db.refresh(organization)
    return organization


@router.get("/{organization_id}", response_model=OrganizationRead, summary="Read an organization")
async def read_organization(organization_id: int, db: DbSession) -> Organization:
    organization = await db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return organization
