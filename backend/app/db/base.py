import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    """Declarative base shared by every ORM model.

    Alembic autogenerate reads ``Base.metadata``, so each model module must be
    imported in ``app/models/__init__.py`` to be picked up.
    """


class IntPrimaryKeyMixin:
    """Adds a sequential BIGINT primary key.

    The database issues the value, so a row has no id until it is flushed.
    BIGINT rather than INT because the range costs four bytes a row and
    removes any question of running out.

    These identifiers travel in URLs, so they are guessable and they leak row
    counts and creation order to anyone who reads them. Authorisation is
    checked on every route that takes one and never infers access from
    knowing an id.
    """

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )


class PublicIdMixin:
    """Adds the identifier this row is known by outside the server.

    The BIGINT primary key stays where it is and keeps every join, but it never
    leaves the server: it is guessable and it counts rows. What reaches a
    browser — the address bar, the JSON it reads, the requests it sends — is
    this UUID instead.

    Version 4 specifically. A time-ordered UUID sorts by creation time, which
    hands back the ordering this exists to hide.

    Defaulted on both sides: the ORM fills it on insert, and the column
    default covers raw SQL, seeds and imports that never build a model.
    """

    public_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        unique=True,
        index=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )


class TimestampMixin:
    """Adds database-managed created/updated timestamps to a model."""

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
