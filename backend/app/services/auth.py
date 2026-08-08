"""Sign-in logic.

Authentication is per-tenant: a user signs in on their organization's
subdomain, and the credentials are only ever checked within that organization.
There is no sign-up — accounts are created by an administrator.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import verify_password
from app.models.organization import Organization
from app.models.user import User


class AuthenticationError(Exception):
    """Sign-in failed.

    Deliberately carries no detail about which part failed, so the API cannot
    leak whether an address is registered with a given organization.
    """


async def get_organization_by_slug(session: AsyncSession, slug: str) -> Organization | None:
    result = await session.execute(
        select(Organization).where(Organization.slug == slug.strip().lower())
    )
    return result.scalar_one_or_none()


async def authenticate(
    session: AsyncSession, *, organization_slug: str, email: str, password: str
) -> tuple[User, Organization]:
    """Return the user and organization for valid credentials.

    Every failure path raises the same error: unknown tenant, unknown address,
    wrong password, deactivated user and deactivated organization are
    indistinguishable from outside.
    """
    organization = await get_organization_by_slug(session, organization_slug)
    if organization is None or not organization.is_active:
        # Still hash something so a missing tenant is not the fast path.
        verify_password(password, None)
        raise AuthenticationError

    result = await session.execute(
        select(User).where(
            User.organization_id == organization.id,
            # Addresses are stored lowercased; compare that way regardless of
            # how the client typed it.
            func.lower(User.email) == email.strip().lower(),
        )
    )
    user = result.scalar_one_or_none()

    is_valid, updated_hash = verify_password(password, user.hashed_password if user else None)
    if not is_valid or user is None or not user.is_active:
        raise AuthenticationError

    if updated_hash is not None:
        user.hashed_password = updated_hash

    return user, organization
