"""ORM models.

Import every model module here so that ``Base.metadata`` is fully populated
before Alembic autogenerates a migration.
"""

from app.db.base import Base

__all__ = ["Base"]
