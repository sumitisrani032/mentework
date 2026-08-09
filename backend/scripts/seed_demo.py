"""Populate the local database with a demo organization.

Run with `npm run db:seed` from the repository root. Safe to re-run: it removes
the previous demo tenant first, and it refuses to touch a non-development
environment.
"""

import asyncio
import sys
from datetime import date

from sqlalchemy import delete

from app.core.config import get_settings
from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from app.models.project import Project, ProjectStatus
from app.models.user import User
from app.services.rbac import assign_role, list_roles, seed_default_roles

DEMO_SLUG = "acme"
# Development only. The script refuses to run outside development.
DEMO_PASSWORD = "mentework"

PEOPLE = [
    ("ada@acme.test", "Ada Okonkwo", "organization-admin", None),
    ("bruno@acme.test", "Bruno Salgado", "project-manager", "WEB"),
    ("chen@acme.test", "Chen Wei", "team-lead", "WEB"),
    ("dara@acme.test", "Dara Nwosu", "member", "WEB"),
    ("eli@acme.test", "Eli Fischer", "member", "MOB"),
    ("fern@acme.test", "Fern Whitaker", "client", "WEB"),
    ("gita@acme.test", "Gita Bhatt", "viewer", "MOB"),
]

PROJECTS = [
    {
        "key": "WEB",
        "name": "Website Relaunch",
        "description": "Rebuild the marketing site and checkout flow.",
        "status": ProjectStatus.ACTIVE,
        "start_date": date(2026, 8, 1),
        "end_date": date(2026, 12, 31),
    },
    {
        "key": "MOB",
        "name": "Mobile App",
        "description": "Native companion app for iOS and Android.",
        "status": ProjectStatus.PLANNING,
        "start_date": date(2026, 10, 1),
        "end_date": date(2027, 3, 31),
    },
    # Left without a team or any logged time on purpose: `npm run db:seed:storefront`
    # fills it, and needs the project to exist first.
    {
        "key": "STO",
        "name": "Storefront Revamp",
        "description": "Storefront and checkout work for the retail client.",
        "status": ProjectStatus.ACTIVE,
        "start_date": date(2026, 7, 1),
        "end_date": date(2026, 12, 31),
    },
]


async def main() -> None:
    settings = get_settings()
    if not settings.is_development:
        sys.exit(f"Refusing to seed: ENVIRONMENT is {settings.environment!r}, not development.")

    async with AsyncSessionLocal() as session:
        await session.execute(delete(Organization).where(Organization.slug == DEMO_SLUG))

        organization = Organization(name="Acme Design", slug=DEMO_SLUG)
        session.add(organization)
        await session.flush()

        await seed_default_roles(session, organization)
        roles = {role.slug: role for role in await list_roles(session, organization.id)}

        # One hash reused across the demo accounts; argon2 is deliberately slow.
        password_hash = hash_password(DEMO_PASSWORD)

        users: dict[str, User] = {}
        for email, full_name, _role_slug, _project_key in PEOPLE:
            user = User(
                organization_id=organization.id,
                email=email,
                full_name=full_name,
                hashed_password=password_hash,
            )
            session.add(user)
            users[email] = user
        await session.flush()

        admin = users[PEOPLE[0][0]]
        manager = users[PEOPLE[1][0]]

        projects: dict[str, Project] = {}
        for spec in PROJECTS:
            project = Project(
                organization_id=organization.id,
                owner_id=manager.id,
                created_by=admin.id,
                **spec,
            )
            session.add(project)
            projects[spec["key"]] = project
        await session.flush()

        for email, _full_name, role_slug, project_key in PEOPLE:
            await assign_role(
                session,
                user_id=users[email].id,
                role=roles[role_slug],
                project_id=projects[project_key].id if project_key else None,
            )

        await session.commit()

        print(f"Seeded organization {organization.name!r} ({organization.slug})")
        print(f"  id:       {organization.id}")
        print(f"  roles:    {len(roles)}")
        print(f"  projects: {len(projects)}")
        print(f"  users:    {len(PEOPLE)}")
        print()
        print(f"  Sign in at /login on the {DEMO_SLUG!r} workspace with:")
        for email, _full_name, role_slug, _project_key in PEOPLE:
            print(f"    {email:22} {DEMO_PASSWORD:12} ({role_slug})")


if __name__ == "__main__":
    asyncio.run(main())
