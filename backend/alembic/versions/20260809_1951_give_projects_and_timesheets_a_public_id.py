"""give projects and timesheets a public id

The BIGINT primary key stays exactly where it is and keeps every join. This
adds the identifier these rows are known by outside the server, so a browser
never sees a key it could count or walk.

Added in three steps rather than one: the column arrives nullable, existing
rows are filled, and only then does it become NOT NULL. Adding it as NOT NULL
in one go would fail against any table that already has rows.

Revision ID: c6d4218b0f8d
Revises: e5b93c1a7d24
Create Date: 2026-08-09 19:51:43.691594+00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c6d4218b0f8d"
down_revision: str | None = "e5b93c1a7d24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

TABLES = ("projects", "timesheets")


def upgrade() -> None:
    for table in TABLES:
        op.add_column(
            table,
            sa.Column(
                "public_id",
                sa.UUID(),
                nullable=True,
                server_default=sa.text("gen_random_uuid()"),
            ),
        )
        # The default only fires for new rows, so fill the ones already there.
        # Each gets its own value: gen_random_uuid() is evaluated per row.
        op.execute(f"UPDATE {table} SET public_id = gen_random_uuid() WHERE public_id IS NULL")
        op.alter_column(table, "public_id", nullable=False)
        op.create_index(f"ix_{table}_public_id", table, ["public_id"], unique=True)


def downgrade() -> None:
    for table in TABLES:
        op.drop_index(f"ix_{table}_public_id", table_name=table)
        op.drop_column(table, "public_id")
