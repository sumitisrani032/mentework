
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.organization import is_valid_slug


class OrganizationCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    slug: str = Field(min_length=1, max_length=63)

    @field_validator("slug")
    @classmethod
    def slug_must_be_usable_as_a_subdomain(cls, value: str) -> str:
        normalised = value.strip().lower()
        if not is_valid_slug(normalised):
            raise ValueError(
                "must be lowercase letters, numbers and hyphens, and not a reserved name"
            )
        return normalised


class OrganizationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    slug: str
    is_active: bool
