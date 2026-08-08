from typing import TYPE_CHECKING

from sqlalchemy import BigInteger, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, IntPrimaryKeyMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.role import Role
    from app.models.user import User


class UserRole(IntPrimaryKeyMixin, TimestampMixin, Base):
    """Grants one role to one user, optionally only within one project.

    A user may hold several roles at once — for example Team Lead on one
    project and Member on another — so their effective permissions are the
    union of every role that applies in the context being checked.
    """

    __tablename__ = "user_roles"
    __table_args__ = (
        # NULLS NOT DISTINCT (PostgreSQL 15+) makes this catch duplicate
        # organization-wide grants too, where project_id is NULL. Without it,
        # PostgreSQL treats every NULL as unique and lets duplicates through.
        UniqueConstraint(
            "user_id",
            "role_id",
            "project_id",
            name="uq_user_roles_user_role_project",
            postgresql_nulls_not_distinct=True,
        ),
    )

    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # NULL means the grant applies across the whole organization. A project
    # role must set this; an organization role must not. That pairing depends
    # on the role's scope, which a CHECK constraint cannot reach, so it is
    # enforced in app.services.rbac.assign_role.
    project_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    user: Mapped["User"] = relationship(back_populates="role_assignments")
    role: Mapped["Role"] = relationship(back_populates="assignments")
    project: Mapped["Project | None"] = relationship()

    def __repr__(self) -> str:
        return f"<UserRole user={self.user_id} role={self.role_id} project={self.project_id}>"
