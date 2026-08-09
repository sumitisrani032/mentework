import re

from pydantic import BaseModel, Field, field_validator

from app.models.role import RoleScope

# Deliberately loose. EmailStr rejects reserved domains such as .test and
# .localhost, which are exactly what development and demo workspaces run on —
# the seeded organization is entirely @acme.test. Anything with one @ and a dot
# after it is accepted; whether an address receives mail is not something a
# regex can answer anyway.
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class MemberCreate(BaseModel):
    """A new account, created with the role it is being hired into.

    A role is required rather than optional: access is granted entirely through
    roles, so an account without one can see nothing and would look broken to
    the person who just received it.
    """

    # Checked here, unlike at sign-in: this is where an address becomes
    # something its owner must type forever.
    email: str = Field(min_length=3, max_length=320)
    full_name: str = Field(min_length=1, max_length=120)
    # The administrator sets a first password and passes it on. Nothing is
    # emailed yet, so there is nowhere else for it to come from.
    password: str = Field(min_length=8, max_length=256)
    role_id: int
    # A project-scoped role can cover several projects at once — someone is
    # rarely on exactly one. One grant is written per project. Required for a
    # project-scoped role, rejected for an organization-wide one.
    project_ids: list[int] = Field(default_factory=list)

    @field_validator("email")
    @classmethod
    def looks_like_an_address(cls, value: str) -> str:
        cleaned = value.strip().lower()
        if not EMAIL_PATTERN.fullmatch(cleaned):
            raise ValueError("must be an email address, e.g. dara@acme.test")
        return cleaned


class MemberUpdate(BaseModel):
    """Take someone out of the workspace, or put them back.

    Deactivation rather than deletion: their account stops working everywhere,
    while the time they logged stays attributed to them. Removing the row
    outright would blank the author of every entry they ever made.
    """

    is_active: bool


class MemberRoleRead(BaseModel):
    """One grant a member holds, named rather than as bare ids."""

    # The assignment's own id, so a single grant can be taken away again.
    id: int
    role: str
    scope: RoleScope
    project: str | None


class MemberRead(BaseModel):
    id: int
    email: str
    full_name: str
    is_active: bool
    roles: list[MemberRoleRead]
