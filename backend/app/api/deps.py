"""Shared request dependencies."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidToken, decode_access_token
from app.db.session import get_db
from app.models.organization import Organization
from app.models.user import User

DbSession = Annotated[AsyncSession, Depends(get_db)]

# auto_error=False so a missing header produces our own 401 with a
# WWW-Authenticate challenge rather than a 403.
bearer_scheme = HTTPBearer(auto_error=False)

CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Not authenticated",
    headers={"WWW-Authenticate": "Bearer"},
)


async def get_current_user(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
) -> User:
    """Resolve the signed-in user, or reject the request.

    The token carries the organization it was issued for, and that is checked
    against the user's current organization on every request — so a token can
    never be replayed against a different tenant.
    """
    if credentials is None:
        raise CREDENTIALS_EXCEPTION

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = int(payload["sub"])
        organization_id = int(payload["org"])
    except (InvalidToken, KeyError, ValueError) as exc:
        raise CREDENTIALS_EXCEPTION from exc

    user = await db.get(User, user_id)
    if user is None or not user.is_active or user.organization_id != organization_id:
        raise CREDENTIALS_EXCEPTION

    organization = await db.get(Organization, organization_id)
    if organization is None or not organization.is_active:
        raise CREDENTIALS_EXCEPTION

    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
