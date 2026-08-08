from datetime import datetime

from sqlalchemy import BigInteger, DateTime, func
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
