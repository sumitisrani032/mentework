import enum
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, IntPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.organization import Organization
    from app.models.user import User


class ProjectStatus(enum.StrEnum):
    PLANNING = "planning"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    COMPLETED = "completed"
    ARCHIVED = "archived"


class Project(IntPrimaryKeyMixin, TimestampMixin, Base):
    """A unit of work inside an organization.

    Role assignments can be scoped to a project, so this is also the boundary
    most permission checks are evaluated against.
    """

    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("organization_id", "key", name="uq_projects_org_key"),
        CheckConstraint(
            "status IN ({})".format(", ".join(f"'{s.value}'" for s in ProjectStatus)),
            name="ck_projects_status_valid",
        ),
        # A project that ends before it starts is a data-entry mistake, not a
        # state the rest of the system should have to cope with.
        CheckConstraint(
            "start_date IS NULL OR end_date IS NULL OR end_date >= start_date",
            name="ck_projects_end_after_start",
        ),
    )

    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    # Short human-readable identifier, e.g. "STO" for Storefront Revamp.
    key: Mapped[str] = mapped_column(String(16), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[ProjectStatus] = mapped_column(
        Enum(
            ProjectStatus,
            name="project_status",
            native_enum=False,
            length=32,
            validate_strings=True,
            values_callable=lambda e: [member.value for member in e],
        ),
        nullable=False,
        default=ProjectStatus.PLANNING,
        server_default=ProjectStatus.PLANNING.value,
    )
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Both are SET NULL rather than CASCADE: losing the person who created a
    # project must not delete the project. Each must belong to the same
    # organization, which is enforced in the service layer.
    owner_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    organization: Mapped["Organization"] = relationship(back_populates="projects")
    owner: Mapped["User | None"] = relationship(foreign_keys=[owner_id])
    creator: Mapped["User | None"] = relationship(foreign_keys=[created_by])

    @property
    def is_archived(self) -> bool:
        return self.status is ProjectStatus.ARCHIVED

    def __repr__(self) -> str:
        return f"<Project key={self.key!r} status={self.status}>"
