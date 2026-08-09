"""let the built-in Member role correct its own time entries

Revision ID: d8a1c2f47b60
Revises: c41d7f0a9e52
Create Date: 2026-08-09 16:00:00.000000+00:00

The split migration copied each role's timesheet row onto the new time_entry
feature, which preserved access exactly — but where an organization's Member
role had never held edit, members could log time and then not fix a typo in
it. New organizations already seed Member with view, create and edit, so this
brings existing ones to the same place.

Only the built-in Member role is touched; custom roles are left alone.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "d8a1c2f47b60"
down_revision: str | None = "c41d7f0a9e52"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE role_permissions
        SET can_view = true, can_create = true, can_edit = true
        WHERE feature = 'time_entry'
          AND role_id IN (SELECT id FROM roles WHERE is_system AND slug = 'member')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE role_permissions
        SET can_edit = false
        WHERE feature = 'time_entry'
          AND role_id IN (SELECT id FROM roles WHERE is_system AND slug = 'member')
        """
    )
