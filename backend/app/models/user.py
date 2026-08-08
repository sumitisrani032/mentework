import enum
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, IntPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class UserRole(enum.StrEnum):
    """Provisional roles, pending the full permission matrix.

    Stored as a VARCHAR with a CHECK constraint rather than a native PostgreSQL
    ENUM: adding or renaming a role is then an ordinary constraint change
    instead of an ``ALTER TYPE``, which cannot run inside a transaction.
    """

    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    GUEST = "guest"


class User(IntPrimaryKeyMixin, TimestampMixin, Base):
    """A person within one organization.

    Users are scoped to a tenant, so the same email address may exist in
    several organizations as distinct accounts.
    """

    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("organization_id", "email", name="uq_users_organization_id_email"),
        # Declared here rather than via Enum(create_constraint=True) so the
        # constraint is part of the model metadata; otherwise autogenerate does
        # not see it and proposes dropping it on every run. The values are
        # derived from UserRole, so adding a role produces a migration.
        CheckConstraint(
            "role IN ({})".format(", ".join(f"'{role.value}'" for role in UserRole)),
            name="ck_users_role_valid",
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Stored lowercased by the application so uniqueness is case-insensitive.
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    # Null for accounts that authenticate through an identity provider only.
    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            native_enum=False,
            # Without an explicit length the column is sized to the longest
            # current value, so a longer role added later would not fit.
            length=32,
            validate_strings=True,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=UserRole.MEMBER,
        server_default=UserRole.MEMBER.value,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    organization: Mapped["Organization"] = relationship(back_populates="users")

    def __repr__(self) -> str:
        return f"<User email={self.email!r} role={self.role}>"
