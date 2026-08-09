"""let the built-in Team Lead role log and correct time

Revision ID: e5b93c1a7d24
Revises: d8a1c2f47b60
Create Date: 2026-08-09 16:15:00.000000+00:00

Same gap as the Member fix before it: the split migration copied each role's
timesheet row onto time_entry, and Team Lead's said view only — so a lead
could read the team's time without logging any of their own. New organizations
already seed Team Lead with view, create and edit.

Only the built-in Team Lead role is touched; custom roles are left alone.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "e5b93c1a7d24"
down_revision: str | None = "d8a1c2f47b60"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE role_permissions
        SET can_view = true, can_create = true, can_edit = true
        WHERE feature = 'time_entry'
          AND role_id IN (SELECT id FROM roles WHERE is_system AND slug = 'team-lead')
        """
    )


def downgrade() -> None:
    op.execute(
        """
        UPDATE role_permissions
        SET can_create = false, can_edit = false
        WHERE feature = 'time_entry'
          AND role_id IN (SELECT id FROM roles WHERE is_system AND slug = 'team-lead')
        """
    )
