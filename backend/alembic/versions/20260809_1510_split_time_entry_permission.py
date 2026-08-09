"""split logging time out of the timesheet permission

Revision ID: c41d7f0a9e52
Revises: a593315a0b83
Create Date: 2026-08-09 15:10:00.000000+00:00

Creating a timesheet and logging time into one are different jobs, so they
become different features. Existing roles keep exactly what they could do:
their timesheet row is copied to the new time_entry feature first. Only then
are the built-in roles realigned, so Member, Team Lead, Client and Viewer can
no longer create, rename or archive timesheets — which they now do not need,
since logging time is its own permission.

Custom roles an organization made itself are left alone.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c41d7f0a9e52"
down_revision: str | None = "a593315a0b83"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

FEATURES = (
    "projects",
    "tasks",
    "timesheet",
    "gantt",
    "calendar",
    "discussions",
    "files",
    "reports",
    "members",
    "roles",
    "billing",
    "settings",
)

CONSTRAINT = "ck_role_permissions_feature_valid"

# Roles that fill a timesheet in rather than set one up.
CONTRIBUTORS = ("member", "team-lead", "client", "viewer")


def _feature_check(features: Sequence[str]) -> str:
    values = ", ".join(f"'{feature}'" for feature in features)
    return f"feature IN ({values})"


def upgrade() -> None:
    op.drop_constraint(CONSTRAINT, "role_permissions", type_="check")
    op.create_check_constraint(
        CONSTRAINT, "role_permissions", _feature_check([*FEATURES, "time_entry"])
    )

    # Whatever a role could do with a timesheet, it can still do with the time
    # inside one. Nobody loses access to logging time on upgrade.
    op.execute(
        """
        INSERT INTO role_permissions (role_id, feature, can_view, can_create, can_edit,
                                      can_delete, created_at, updated_at)
        SELECT role_id, 'time_entry', can_view, can_create, can_edit,
               can_delete, now(), now()
        FROM role_permissions
        WHERE feature = 'timesheet'
          AND role_id NOT IN (SELECT role_id FROM role_permissions WHERE feature = 'time_entry')
        """
    )

    # Built-in roles that are not managers keep sight of timesheets but stop
    # being able to create or change them.
    op.execute(
        f"""
        UPDATE role_permissions
        SET can_create = false, can_edit = false, can_delete = false
        WHERE feature = 'timesheet'
          AND role_id IN (
            SELECT id FROM roles
            WHERE is_system AND slug IN {CONTRIBUTORS}
          )
        """
    )


def downgrade() -> None:
    # Fold the entry permission back into the timesheet one, so the roles that
    # could log time can again do so through the single feature.
    op.execute(
        """
        UPDATE role_permissions AS sheet
        SET can_view = sheet.can_view OR entry.can_view,
            can_create = entry.can_create,
            can_edit = entry.can_edit,
            can_delete = entry.can_delete
        FROM role_permissions AS entry
        WHERE entry.feature = 'time_entry'
          AND sheet.feature = 'timesheet'
          AND sheet.role_id = entry.role_id
        """
    )
    op.execute("DELETE FROM role_permissions WHERE feature = 'time_entry'")

    op.drop_constraint(CONSTRAINT, "role_permissions", type_="check")
    op.create_check_constraint(CONSTRAINT, "role_permissions", _feature_check(FEATURES))
