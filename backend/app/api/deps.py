"""Shared request dependencies."""

from collections.abc import Callable, Coroutine
from typing import Annotated, Any, Literal

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import InvalidToken, decode_access_token
from app.db.session import get_db
from app.models.organization import Organization
from app.models.project import Project
from app.models.role import Feature
from app.models.user import User
from app.services.rbac import effective_permissions

Action = Literal["view", "create", "edit", "delete"]

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


def _forbidden(feature: Feature, action: Action) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Your roles do not allow you to {action} {feature.value}.",
    )


def require_permission(
    feature: Feature, action: Action
) -> Callable[..., Coroutine[Any, Any, User]]:
    """Require an organization-wide permission.

    Use for things that are not scoped to a project — roles, billing,
    organization settings.
    """

    async def dependency(current_user: CurrentUser, db: DbSession) -> User:
        granted = await effective_permissions(db, user_id=current_user.id)
        if not getattr(granted[feature], action):
            raise _forbidden(feature, action)
        return current_user

    return dependency


def require_project_permission(
    feature: Feature, action: Action
) -> Callable[..., Coroutine[Any, Any, Project]]:
    """Require a permission inside the project named in the path.

    Resolves ``project_id`` and returns the project, so routes do not fetch it
    again. A project in another organization is reported as missing rather than
    forbidden, so the endpoint cannot be used to probe which ids exist.
    """

    async def dependency(
        project_id: int, current_user: CurrentUser, db: DbSession
    ) -> Project:
        project = await db.get(Project, project_id)
        if project is None or project.organization_id != current_user.organization_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found")

        granted = await effective_permissions(db, user_id=current_user.id, project_id=project_id)
        if not getattr(granted[feature], action):
            raise _forbidden(feature, action)
        return project

    return dependency
