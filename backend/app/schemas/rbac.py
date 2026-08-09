import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.role import Feature, RoleScope


class PermissionBase(BaseModel):
    feature: Feature
    can_view: bool = False
    can_create: bool = False
    can_edit: bool = False
    can_delete: bool = False


class PermissionRead(PermissionBase):
    model_config = ConfigDict(from_attributes=True)


class PermissionWrite(PermissionBase):
    @model_validator(mode="after")
    def view_must_be_granted_first(self) -> "PermissionWrite":
        """Mirror the database CHECK, so a bad matrix is a 422 and not a 500."""
        if (self.can_create or self.can_edit or self.can_delete) and not self.can_view:
            raise ValueError(
                f"{self.feature.value}: cannot grant create, edit or delete without view"
            )
        return self


class PermissionMatrixUpdate(BaseModel):
    permissions: list[PermissionWrite]

    @model_validator(mode="after")
    def features_must_be_unique(self) -> "PermissionMatrixUpdate":
        seen = [permission.feature for permission in self.permissions]
        if len(seen) != len(set(seen)):
            raise ValueError("each feature may appear only once")
        return self


class RoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    name: str
    description: str | None
    scope: RoleScope
    is_system: bool
    permissions: list[PermissionRead]


class RoleCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=255)
    scope: RoleScope


class FeatureRead(BaseModel):
    """One row of the settings grid."""

    value: Feature
    label: str


class RoleMatrixRead(BaseModel):
    """Everything the permissions screen needs in one response."""

    features: list[FeatureRead]
    roles: list[RoleRead]


class UserRoleCreate(BaseModel):
    role_id: int
    # The project's public id: this arrives from a browser, which is never
    # given a row key. Required for project-scoped roles, rejected for
    # organization-scoped ones.
    project_id: uuid.UUID | None = None


class UserRoleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    role_id: int
    project_id: uuid.UUID | None
