import pytest

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
