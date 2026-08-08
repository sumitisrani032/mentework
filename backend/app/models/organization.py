import re
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, String, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, IntPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.user import User

# Reserved subdomains that must never be handed to a tenant, because they are
# used by the marketing site and shared infrastructure.
RESERVED_SLUGS = frozenset(
    {
        "admin",
        "api",
        "app",
        "assets",
        "billing",
        "blog",
        "cdn",
        "dashboard",
        "docs",
        "help",
        "mail",
        "static",
        "status",
        "support",
        "www",
    }
)

# 63 characters is the maximum length of a single DNS label.
SLUG_MAX_LENGTH = 63

# Kept in step with ck_organizations_slug_format so the application can reject a
# bad slug with a helpful message before the database raises.
SLUG_PATTERN = re.compile(r"^[a-z0-9]([a-z0-9-]*[a-z0-9])?$")


def is_valid_slug(slug: str) -> bool:
    """Return whether ``slug`` may be used as a tenant subdomain."""
    return (
        len(slug) <= SLUG_MAX_LENGTH
        and SLUG_PATTERN.fullmatch(slug) is not None
        and slug not in RESERVED_SLUGS
    )


class Organization(IntPrimaryKeyMixin, TimestampMixin, Base):
    """A tenant.

    This is the root of the data model: every other record belongs to exactly
    one organization, and tenants are addressed as ``<slug>.mentework.com``.
    """

    __tablename__ = "organizations"
    __table_args__ = (
        # Enforced in the database so a bad slug can never reach DNS, whatever
        # the application layer does.
        CheckConstraint(
            "slug ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$'",
            name="ck_organizations_slug_format",
        ),
    )

    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(SLUG_MAX_LENGTH), nullable=False, unique=True, index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    users: Mapped[list["User"]] = relationship(
        back_populates="organization",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Organization slug={self.slug!r}>"
