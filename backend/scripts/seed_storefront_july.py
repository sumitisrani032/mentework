"""Put a team on the Storefront project and fill a month of their time.

Enough people, and enough logged days, to see what a shared project timesheet
actually looks like — the demo seed leaves Storefront empty.

Run with `npm run db:seed:storefront` from the repository root. Safe to re-run:
existing accounts are reused and July's entries are replaced rather than
duplicated. Refuses to run outside development.
"""

import asyncio
import sys
from datetime import date, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from app.models.project import Project
from app.models.timesheet import TimeEntry, TimeEntryStatus, Timesheet, TimesheetAssignee
from app.models.user import User
from app.models.user_role import UserRole
from app.services.rbac import assign_role, list_roles

DEMO_SLUG = "acme"
DEMO_PASSWORD = "mentework"
PROJECT_KEY = "STO"
TIMESHEET_TITLE = "Storefront Timesheet"

MONTH = (2026, 7)

TEAM = [
    ("hana@acme.test", "Hana Yusuf", "project-manager"),
    ("ivan@acme.test", "Ivan Petrov", "team-lead"),
    ("jia@acme.test", "Jia Chen", "member"),
    ("karim@acme.test", "Karim Haddad", "member"),
    ("lena@acme.test", "Lena Novak", "member"),
]

# What each person spends their days on, cycled through so the listing reads
# like a real month rather than one repeated line.
WORK = {
    "hana@acme.test": [
        "Sprint planning and stakeholder review",
        "Scope for the checkout rebuild",
        "Vendor call: payments provider",
        "Roadmap and release notes",
    ],
    "ivan@acme.test": [
        "Code review: catalogue service",
        "Pairing on the search index",
        "Refactor of the cart module",
        "Incident follow-up and postmortem",
    ],
    "jia@acme.test": [
        "Product listing page",
        "Basket drawer states",
        "Checkout form validation",
        "Responsive fixes on mobile",
    ],
    "karim@acme.test": [
        "Payment gateway integration",
        "Order confirmation emails",
        "Stock sync job",
        "Investigated the checkout regression",
    ],
    "lena@acme.test": [
        "Design QA on the product page",
        "Empty and error states",
        "Accessibility pass on the nav",
        "Copy review with marketing",
    ],
}

# Minutes per entry, cycled per person so days differ in length.
DURATIONS = {
    "hana@acme.test": [180, 240, 120, 300],
    "ivan@acme.test": [300, 240, 360, 180],
    "jia@acme.test": [420, 360, 300, 480],
    "karim@acme.test": [360, 480, 240, 420],
    "lena@acme.test": [240, 300, 180, 360],
}


# Earlier weeks are billed, the middle is billable, the last week is unmarked —
# roughly how a month looks part-way through invoicing.
def status_for(day: date) -> TimeEntryStatus:
    if day.day <= 10:
        return TimeEntryStatus.BILLED
    if day.day <= 24:
        return TimeEntryStatus.BILLABLE
    return TimeEntryStatus.NONE


def weekdays(year: int, month: int) -> list[date]:
    day = date(year, month, 1)
    days = []
    while day.month == month:
        if day.weekday() < 5:
            days.append(day)
        day += timedelta(days=1)
    return days


async def main() -> None:
    settings = get_settings()
    if not settings.is_development:
        sys.exit(f"Refusing to seed: ENVIRONMENT is {settings.environment!r}, not development.")

    async with AsyncSessionLocal() as session:
        organization = await _require(
            session,
            select(Organization).where(Organization.slug == DEMO_SLUG),
            f"No {DEMO_SLUG!r} organization. Run `npm run db:seed` first.",
        )
        project = await _require(
            session,
            select(Project).where(
                Project.organization_id == organization.id, Project.key == PROJECT_KEY
            ),
            f"No project with key {PROJECT_KEY!r}.",
        )
        timesheet = await _require(
            session,
            select(Timesheet)
            .where(Timesheet.project_id == project.id, Timesheet.title == TIMESHEET_TITLE)
            .options(selectinload(Timesheet.assignees)),
            f"No timesheet titled {TIMESHEET_TITLE!r} in {project.name}.",
        )

        roles = {role.slug: role for role in await list_roles(session, organization.id)}
        password = hash_password(DEMO_PASSWORD)

        team: list[User] = []
        for email, full_name, role_slug in TEAM:
            user = (
                await session.execute(
                    select(User).where(User.organization_id == organization.id, User.email == email)
                )
            ).scalar_one_or_none()

            if user is None:
                user = User(
                    organization_id=organization.id,
                    email=email,
                    full_name=full_name,
                    hashed_password=password,
                )
                session.add(user)
                await session.flush()

            if not await _has_role(session, user, roles[role_slug], project):
                await assign_role(
                    session, user_id=user.id, role=roles[role_slug], project_id=project.id
                )

            # The timesheet is private, so being on the project is not enough to
            # see it — its assignees are who it is shared with.
            if all(existing.user_id != user.id for existing in timesheet.assignees):
                session.add(TimesheetAssignee(timesheet_id=timesheet.id, user_id=user.id))

            team.append(user)

        days = weekdays(*MONTH)
        first, last = days[0], days[-1]
        await session.execute(
            delete(TimeEntry).where(
                TimeEntry.timesheet_id == timesheet.id,
                TimeEntry.creator_id.in_([user.id for user in team]),
                TimeEntry.entry_date.between(first, last),
            )
        )

        logged = 0
        for index, user in enumerate(team):
            descriptions = WORK[user.email]
            durations = DURATIONS[user.email]
            # Each person skips a different day of the week, so the month is not
            # a solid block of identical rows.
            for position, day in enumerate(days):
                if (position + index) % 4 == 3:
                    continue
                session.add(
                    TimeEntry(
                        timesheet_id=timesheet.id,
                        entry_date=day,
                        logged_minutes=durations[position % len(durations)],
                        status=status_for(day),
                        description=descriptions[position % len(descriptions)],
                        creator_id=user.id,
                    )
                )
                logged += 1

        await session.commit()

        print(f"Seeded {timesheet.title!r} in {project.name} ({project.key})")
        print(f"  team:    {len(team)} people, all assigned to the timesheet")
        print(f"  entries: {logged} across {first} to {last}")
        print(f"  sign in: any of {', '.join(email for email, _, _ in TEAM)} / {DEMO_PASSWORD}")


async def _has_role(session: AsyncSession, user: User, role, project: Project) -> bool:
    existing = await session.execute(
        select(UserRole).where(
            UserRole.user_id == user.id,
            UserRole.role_id == role.id,
            UserRole.project_id == project.id,
        )
    )
    return existing.scalar_one_or_none() is not None


async def _require(session: AsyncSession, query, message: str):
    result = (await session.execute(query)).scalars().first()
    if result is None:
        sys.exit(message)
    return result


if __name__ == "__main__":
    asyncio.run(main())
