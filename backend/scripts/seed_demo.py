"""Populate the local database with a demo organization.

Run with `npm run db:seed` from the repository root. Safe to re-run: it removes
the previous demo tenant first, and it refuses to touch a non-development
environment.
"""

import asyncio
import sys

from sqlalchemy import delete

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from app.models.project import Project
from app.models.user import User
from app.services.rbac import assign_role, list_roles, seed_default_roles

DEMO_SLUG = "acme"

PEOPLE = [
    ("ada@acme.test", "Ada Okonkwo", "organization-admin", None),
    ("bruno@acme.test", "Bruno Salgado", "project-manager", "WEB"),
    ("chen@acme.test", "Chen Wei", "team-lead", "WEB"),
    ("dara@acme.test", "Dara Nwosu", "member", "WEB"),
    ("eli@acme.test", "Eli Fischer", "member", "MOB"),
    ("fern@acme.test", "Fern Whitaker", "client", "WEB"),
    ("gita@acme.test", "Gita Bhatt", "viewer", "MOB"),
]

PROJECTS = [("WEB", "Website Relaunch"), ("MOB", "Mobile App")]


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

        projects = {}
        for key, name in PROJECTS:
            project = Project(organization_id=organization.id, key=key, name=name)
            session.add(project)
            projects[key] = project
        await session.flush()

        for email, full_name, role_slug, project_key in PEOPLE:
            user = User(organization_id=organization.id, email=email, full_name=full_name)
            session.add(user)
            await session.flush()
            await assign_role(
                session,
                user_id=user.id,
                role=roles[role_slug],
                project_id=projects[project_key].id if project_key else None,
            )

        await session.commit()

        print(f"Seeded organization {organization.name!r} ({organization.slug})")
        print(f"  id:       {organization.id}")
        print(f"  roles:    {len(roles)}")
        print(f"  projects: {len(projects)}")
        print(f"  users:    {len(PEOPLE)}")


if __name__ == "__main__":
    asyncio.run(main())
