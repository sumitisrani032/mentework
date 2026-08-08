
from pydantic import BaseModel, ConfigDict, Field

from app.models.role import Feature


class LoginRequest(BaseModel):
    # The tenant the sign-in page belongs to, taken from the subdomain.
    organization_slug: str = Field(min_length=1, max_length=63)
    # Deliberately not EmailStr. Sign-in only compares against a stored
    # address, so strict format validation adds no safety — and it would answer
    # a malformed address with 422 while wrong credentials get 401, which is
    # itself something an attacker could measure. Format is validated where
    # accounts are created instead.
    email: str = Field(min_length=1, max_length=320)
    password: str = Field(min_length=1, max_length=256)


class SignInOrganization(BaseModel):
    """The little a sign-in page may reveal before anyone authenticates."""

    model_config = ConfigDict(from_attributes=True)

    name: str
    slug: str


class AuthenticatedUser(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: AuthenticatedUser
    organization: SignInOrganization


class PermissionGrant(BaseModel):
    feature: Feature
    can_view: bool
    can_create: bool
    can_edit: bool
    can_delete: bool


class CurrentUserResponse(BaseModel):
    user: AuthenticatedUser
    organization: SignInOrganization
    roles: list[str]
    permissions: list[PermissionGrant]
