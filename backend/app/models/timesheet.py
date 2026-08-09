import enum
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, IntPrimaryKeyMixin, PublicIdMixin, TimestampMixin

if TYPE_CHECKING:
    from app.models.project import Project
    from app.models.user import User


class TimeEntryStatus(enum.StrEnum):
    """Where a logged block of time sits in the billing cycle."""

    NONE = "none"
    BILLABLE = "billable"
    BILLED = "billed"


class Timesheet(IntPrimaryKeyMixin, PublicIdMixin, TimestampMixin, Base):
    """A named bucket of time within one project.

    Only the *estimate* is stored. Logged, billable and billed totals are
    derived from the entries underneath, so the two can never disagree.
    """

    __tablename__ = "timesheets"
    __table_args__ = (
        CheckConstraint(
            "estimated_minutes IS NULL OR estimated_minutes >= 0",
            name="ck_timesheets_estimate_not_negative",
        ),
    )

    project_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    # Stored as a single total rather than hours + minutes: it makes arithmetic
    # trivial and rules out states like "1 hour 90 minutes".
    estimated_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Private timesheets are visible only to their creator and assignees.
    is_private: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    is_archived: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    creator_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    project: Mapped["Project"] = relationship()
    creator: Mapped["User | None"] = relationship()
    assignees: Mapped[list["TimesheetAssignee"]] = relationship(
        back_populates="timesheet",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    entries: Mapped[list["TimeEntry"]] = relationship(
        back_populates="timesheet",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    def __repr__(self) -> str:
        return f"<Timesheet title={self.title!r}>"


class TimesheetAssignee(Base):
    """Joins a timesheet to the people responsible for it."""

    __tablename__ = "timesheet_assignees"
    # The composite primary key below already makes each pair unique; a
    # separate UniqueConstraint would only duplicate it.

    timesheet_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("timesheets.id", ondelete="CASCADE"),
        primary_key=True,
    )
    user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )

    timesheet: Mapped["Timesheet"] = relationship(back_populates="assignees")
    user: Mapped["User"] = relationship()


class TimeEntry(IntPrimaryKeyMixin, TimestampMixin, Base):
    """One block of time logged against a timesheet."""

    __tablename__ = "time_entries"
    __table_args__ = (
        CheckConstraint("logged_minutes > 0", name="ck_time_entries_logged_positive"),
        CheckConstraint(
            "status IN ({})".format(", ".join(f"'{s.value}'" for s in TimeEntryStatus)),
            name="ck_time_entries_status_valid",
        ),
    )

    timesheet_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("timesheets.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # The day the work happened, which is not necessarily the day it was logged.
    entry_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    logged_minutes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[TimeEntryStatus] = mapped_column(
        Enum(
            TimeEntryStatus,
            name="time_entry_status",
            native_enum=False,
            length=32,
            validate_strings=True,
            values_callable=lambda e: [member.value for member in e],
        ),
        nullable=False,
        default=TimeEntryStatus.NONE,
        server_default=TimeEntryStatus.NONE.value,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    # True when the entry came from a running timer rather than manual entry.
    from_timer: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=text("false")
    )
    creator_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    timesheet: Mapped["Timesheet"] = relationship(back_populates="entries")
    creator: Mapped["User | None"] = relationship()

    def __repr__(self) -> str:
        return f"<TimeEntry {self.entry_date} {self.logged_minutes}m {self.status}>"
