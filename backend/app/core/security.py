"""Password hashing and access tokens."""

from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

# Argon2id, the current password-hashing recommendation.
_hasher = PasswordHash.recommended()

TOKEN_TYPE = "access"


def hash_password(plain: str) -> str:
    return _hasher.hash(plain)


def verify_password(plain: str, hashed: str | None) -> tuple[bool, str | None]:
    """Check a password and report a rehash if the stored one is outdated.

    Returns ``(is_valid, updated_hash)``. ``updated_hash`` is set only when the
    password was correct but stored with older parameters, so the caller can
    transparently upgrade it.

    Users who authenticate through an identity provider have no hash. Returning
    early would make those accounts measurably faster to probe, so a throwaway
    hash is computed instead to keep the timing comparable.
    """
    if hashed is None:
        _hasher.hash(plain)
        return False, None
    return _hasher.verify_and_update(plain, hashed)


def create_access_token(*, user_id: int, organization_id: int, slug: str) -> str:
    """Mint a token that is only valid for one user inside one organization."""
    settings = get_settings()
    issued_at = datetime.now(UTC)
    payload: dict[str, Any] = {
        "sub": str(user_id),
        "org": str(organization_id),
        "slug": slug,
        "typ": TOKEN_TYPE,
        "iat": issued_at,
        "exp": issued_at + timedelta(minutes=settings.access_token_expire_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


class InvalidToken(Exception):
    """Raised when a token is missing, malformed, expired or not an access token."""


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["exp", "sub", "org"]},
        )
    except jwt.PyJWTError as exc:
        raise InvalidToken(str(exc)) from exc

    if payload.get("typ") != TOKEN_TYPE:
        raise InvalidToken("not an access token")
    return payload
