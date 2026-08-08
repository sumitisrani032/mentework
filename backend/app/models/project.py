from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, Boolean, ForeignKey, String, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, IntPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.organization import Organization


class Project(IntPrimaryKeyMixin, TimestampMixin, Base):
    """A unit of work inside an organization.

    Deliberately minimal for now: it exists so role assignments can be scoped to
    a project. Expect this to grow when project features are built out.
    """

    __tablename__ = "projects"
    __table_args__ = (UniqueConstraint("organization_id", "key", name="uq_projects_org_key"),)

    organization_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    # Short human-readable identifier, e.g. "WEB" for the Website project.
    key: Mapped[str] = mapped_column(String(16), nullable=False)
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )

    organization: Mapped["Organization"] = relationship(back_populates="projects")

    def __repr__(self) -> str:
        return f"<Project key={self.key!r}>"
