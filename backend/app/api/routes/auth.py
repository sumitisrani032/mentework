"""Sign-in endpoints.

Sign-in only: accounts are created by an administrator, so there is no
registration route. Every request names the organization whose sign-in page it
came from, and credentials are only checked inside that tenant.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.organization import Organization
from app.models.role import Role
from app.models.user import User
from app.models.user_role import UserRole
from app.schemas.auth import (
    AuthenticatedUser,
    CurrentUserResponse,
    LoginRequest,
    LoginResponse,
    PermissionGrant,
    SignInOrganization,
)
from app.services import auth as auth_service
from app.services.rbac import effective_permissions

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get(
    "/organizations/{slug}",
    response_model=SignInOrganization,
    summary="Look up a tenant for its sign-in page",
)
async def read_sign_in_organization(slug: str, db: DbSession) -> Organization:
    """Return the name to show above the sign-in form.

    Only the name and slug are exposed — nothing that would help enumerate
    members of a tenant.
    """
    organization = await auth_service.get_organization_by_slug(db, slug)
    if organization is None or not organization.is_active:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown workspace")
    return organization


@router.post("/login", response_model=LoginResponse, summary="Sign in to a workspace")
async def login(payload: LoginRequest, db: DbSession) -> LoginResponse:
    try:
        user, organization = await auth_service.authenticate(
            db,
            organization_slug=payload.organization_slug,
            email=payload.email,
            password=payload.password,
        )
    except auth_service.AuthenticationError as exc:
        # One message for every failure, so nothing can be enumerated.
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    user.last_login_at = datetime.now(UTC)
    await db.commit()

    settings = get_settings()
    token = create_access_token(
        user_id=user.id, organization_id=organization.id, slug=organization.slug
    )
    return LoginResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=AuthenticatedUser.model_validate(user),
        organization=SignInOrganization.model_validate(organization),
    )


@router.get("/me", response_model=CurrentUserResponse, summary="Read the signed-in user")
async def read_me(current_user: CurrentUser, db: DbSession) -> CurrentUserResponse:
    """Return the user with the roles and permissions they hold organization-wide."""
    organization = await db.get(Organization, current_user.organization_id)
    assert organization is not None  # guaranteed by get_current_user

    granted = await effective_permissions(db, user_id=current_user.id)
    roles = await _role_names(db, current_user)

    return CurrentUserResponse(
        user=AuthenticatedUser.model_validate(current_user),
        organization=SignInOrganization.model_validate(organization),
        roles=roles,
        permissions=[
            PermissionGrant(
                feature=feature,
                can_view=permission.view,
                can_create=permission.create,
                can_edit=permission.edit,
                can_delete=permission.delete,
            )
            for feature, permission in granted.items()
        ],
    )


async def _role_names(db: AsyncSession, user: User) -> list[str]:
    result = await db.execute(
        select(Role.name)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user.id)
        .order_by(Role.name)
    )
    return sorted(set(result.scalars().all()))
