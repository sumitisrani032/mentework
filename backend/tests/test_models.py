import pytest

from app.models import UserRole
from app.models.organization import SLUG_MAX_LENGTH, is_valid_slug


@pytest.mark.parametrize(
    "slug",
    ["acme", "acme-design", "a", "a1", "team-42", "x" * SLUG_MAX_LENGTH],
)
def test_accepts_valid_slugs(slug: str) -> None:
    assert is_valid_slug(slug)


@pytest.mark.parametrize(
    ("slug", "reason"),
    [
        ("Acme", "uppercase"),
        ("acme_design", "underscore"),
        ("-acme", "leading hyphen"),
        ("acme-", "trailing hyphen"),
        ("acme design", "space"),
        ("", "empty"),
        ("x" * (SLUG_MAX_LENGTH + 1), "longer than a DNS label"),
        ("www", "reserved"),
        ("api", "reserved"),
    ],
)
def test_rejects_invalid_slugs(slug: str, reason: str) -> None:
    assert not is_valid_slug(slug), reason


def test_role_values_are_lowercase_strings() -> None:
    # The CHECK constraint on users.role is built from these values.
    assert [role.value for role in UserRole] == ["owner", "admin", "member", "guest"]
    assert all(role.value.islower() for role in UserRole)


def test_roles_fit_the_column() -> None:
    # users.role is VARCHAR(32); a longer role would be silently untestable
    # until an insert fails in production.
    assert max(len(role.value) for role in UserRole) <= 32
