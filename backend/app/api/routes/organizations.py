"""Organization endpoints.

A tenant may only ever read itself. There is deliberately no route that lists
organizations and none that creates one: provisioning a tenant is an operator
action, not something reachable over the API. Use `npm run org:create`.
"""


from fastapi import APIRouter, HTTPException, status

from app.api.deps import CurrentUser, DbSession
from app.models.organization import Organization
from app.schemas.organization import OrganizationRead

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.get("/me", response_model=OrganizationRead, summary="Read your own organization")
async def read_my_organization(current_user: CurrentUser, db: DbSession) -> Organization:
    organization = await db.get(Organization, current_user.organization_id)
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return organization


@router.get("/{organization_id}", response_model=OrganizationRead, summary="Read an organization")
async def read_organization(
    organization_id: int, current_user: CurrentUser, db: DbSession
) -> Organization:
    """Only the caller's own organization.

    Another tenant's id is reported as missing rather than forbidden, so this
    cannot be used to discover which organizations exist.
    """
    if organization_id != current_user.organization_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")

    organization = await db.get(Organization, organization_id)
    if organization is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Organization not found")
    return organization
