import enum
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
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
    from app.models.user_role import UserRole


class RoleScope(enum.StrEnum):
    """Where a role can be granted."""

    ORGANIZATION = "organization"
    PROJECT = "project"


class Feature(enum.StrEnum):
    """The areas of the product that permissions are granted over.

    These are the rows of the permission matrix an organization admin edits.
    """

    PROJECTS = "projects"
    TASKS = "tasks"
    # The timesheet itself — creating, renaming and archiving the buckets time
    # is logged into.
    TIMESHEET = "timesheet"
    # Logging time into one. Separate because the two are different jobs: a
    # manager sets up the month, everyone on the project fills it in.
    TIME_ENTRY = "time_entry"
    GANTT = "gantt"
    CALENDAR = "calendar"
    DISCUSSIONS = "discussions"
    FILES = "files"
    REPORTS = "reports"
    MEMBERS = "members"
    ROLES = "roles"
    BILLING = "billing"
    SETTINGS = "settings"


def _enum_column(enum_type: type[enum.StrEnum], name: str) -> Enum:
    """A VARCHAR-backed enum, so adding a value is not an ALTER TYPE."""
    return Enum(
        enum_type,
        name=name,
        native_enum=False,
        length=32,
        validate_strings=True,
        values_callable=lambda e: [member.value for member in e],
    )


def _in_clause(column: str, enum_type: type[enum.StrEnum]) -> str:
    values = ", ".join(f"'{member.value}'" for member in enum_type)
    return f"{column} IN ({values})"


class Role(IntPrimaryKeyMixin, TimestampMixin, Base):
    """A named set of permissions belonging to one organization.

    Roles are per-organization rather than global, so an admin can retune what
    "Team Lead" means for their own tenant without affecting anyone else. The
    seeded defaults are marked ``is_system`` and cannot be deleted or renamed,
    but their permissions remain editable.
    """

    __tablename__ = "roles"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", name="uq_roles_organization_id_slug"),
        CheckConstraint(_in_clause("scope", RoleScope), name="ck_roles_scope_valid"),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    slug: Mapped[str] = mapped_column(String(64), nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    scope: Mapped[RoleScope] = mapped_column(_enum_column(RoleScope, "role_scope"), nullable=False)
    is_system: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    organization: Mapped["Organization"] = relationship(back_populates="roles")
    permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="RolePermission.feature",
    )
    assignments: Mapped[list["UserRole"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Role slug={self.slug!r} scope={self.scope}>"


class RolePermission(IntPrimaryKeyMixin, TimestampMixin, Base):
    """One row of the permission matrix: what a role may do with one feature.

    The four booleans are exactly the checkbox columns shown in organization
    settings.
    """

    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "feature", name="uq_role_permissions_role_id_feature"),
        CheckConstraint(_in_clause("feature", Feature), name="ck_role_permissions_feature_valid"),
        # You cannot create, edit or delete something you cannot see, so any of
        # those implies view. This keeps the matrix internally consistent no
        # matter what the UI sends.
        CheckConstraint(
            "can_view OR NOT (can_create OR can_edit OR can_delete)",
            name="ck_role_permissions_view_implied",
        ),
    )

    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    feature: Mapped[Feature] = mapped_column(_enum_column(Feature, "feature"), nullable=False)
    can_view: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    can_create: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    can_edit: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    can_delete: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    role: Mapped["Role"] = relationship(back_populates="permissions")

    def __repr__(self) -> str:
        return f"<RolePermission feature={self.feature} view={self.can_view}>"
