"""expand project attributes

Revision ID: 2f432e8a2b37
Revises: c359ff3b4de8
Create Date: 2026-08-08 16:02:18.589349+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "2f432e8a2b37"
down_revision: str | None = "c359ff3b4de8"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("projects", sa.Column("description", sa.Text(), nullable=True))
    op.add_column(
        "projects",
        sa.Column(
            "status",
            sa.Enum(
                "planning",
                "active",
                "on_hold",
                "completed",
                "archived",
                name="project_status",
                native_enum=False,
                length=32,
            ),
            server_default="planning",
            nullable=False,
        ),
    )
    op.add_column("projects", sa.Column("start_date", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("end_date", sa.Date(), nullable=True))
    op.add_column("projects", sa.Column("owner_id", sa.BigInteger(), nullable=True))
    op.add_column("projects", sa.Column("created_by", sa.BigInteger(), nullable=True))
    op.create_index(op.f("ix_projects_owner_id"), "projects", ["owner_id"], unique=False)
    op.create_foreign_key(None, "projects", "users", ["owner_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key(None, "projects", "users", ["created_by"], ["id"], ondelete="SET NULL")
    op.create_check_constraint(
        "ck_projects_end_after_start",
        "projects",
        "start_date IS NULL OR end_date IS NULL OR end_date >= start_date",
    )
    op.create_check_constraint(
        "ck_projects_status_valid",
        "projects",
        "status IN ('planning', 'active', 'on_hold', 'completed', 'archived')",
    )
    op.drop_column("projects", "is_archived")


def downgrade() -> None:
    op.add_column(
        "projects",
        sa.Column(
            "is_archived",
            sa.BOOLEAN(),
            server_default=sa.text("false"),
            autoincrement=False,
            nullable=False,
        ),
    )
    op.drop_constraint("ck_projects_status_valid", "projects", type_="check")
    op.drop_constraint("ck_projects_end_after_start", "projects", type_="check")
    op.drop_constraint(None, "projects", type_="foreignkey")
    op.drop_constraint(None, "projects", type_="foreignkey")
    op.drop_index(op.f("ix_projects_owner_id"), table_name="projects")
    op.drop_column("projects", "created_by")
    op.drop_column("projects", "owner_id")
    op.drop_column("projects", "end_date")
    op.drop_column("projects", "start_date")
    op.drop_column("projects", "status")
    op.drop_column("projects", "description")
