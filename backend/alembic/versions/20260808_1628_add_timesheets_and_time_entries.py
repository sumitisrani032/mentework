"""add timesheets and time entries

Revision ID: a593315a0b83
Revises: 2f432e8a2b37
Create Date: 2026-08-08 16:28:22.990744+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a593315a0b83"
down_revision: str | None = "2f432e8a2b37"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "timesheets",
        sa.Column("project_id", sa.BigInteger(), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("estimated_minutes", sa.Integer(), nullable=True),
        sa.Column("is_private", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("creator_id", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "estimated_minutes IS NULL OR estimated_minutes >= 0",
            name="ck_timesheets_estimate_not_negative",
        ),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_timesheets_project_id"), "timesheets", ["project_id"], unique=False)
    op.create_table(
        "time_entries",
        sa.Column("timesheet_id", sa.BigInteger(), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("logged_minutes", sa.Integer(), nullable=False),
        sa.Column(
            "status",
            sa.Enum(
                "none", "billable", "billed", name="time_entry_status", native_enum=False, length=32
            ),
            server_default="none",
            nullable=False,
        ),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("from_timer", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("creator_id", sa.BigInteger(), nullable=True),
        sa.Column("id", sa.BigInteger(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "status IN ('none', 'billable', 'billed')", name="ck_time_entries_status_valid"
        ),
        sa.CheckConstraint("logged_minutes > 0", name="ck_time_entries_logged_positive"),
        sa.ForeignKeyConstraint(["creator_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["timesheet_id"], ["timesheets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_time_entries_creator_id"), "time_entries", ["creator_id"], unique=False
    )
    op.create_index(
        op.f("ix_time_entries_entry_date"), "time_entries", ["entry_date"], unique=False
    )
    op.create_index(
        op.f("ix_time_entries_timesheet_id"), "time_entries", ["timesheet_id"], unique=False
    )
    op.create_table(
        "timesheet_assignees",
        sa.Column("timesheet_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.BigInteger(), nullable=False),
        sa.ForeignKeyConstraint(["timesheet_id"], ["timesheets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("timesheet_id", "user_id"),
    )


def downgrade() -> None:
    op.drop_table("timesheet_assignees")
    op.drop_index(op.f("ix_time_entries_timesheet_id"), table_name="time_entries")
    op.drop_index(op.f("ix_time_entries_entry_date"), table_name="time_entries")
    op.drop_index(op.f("ix_time_entries_creator_id"), table_name="time_entries")
    op.drop_table("time_entries")
    op.drop_index(op.f("ix_timesheets_project_id"), table_name="timesheets")
    op.drop_table("timesheets")
