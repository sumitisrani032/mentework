"""Provision a tenant and its first administrator.

    npm run org:create -- --name "Acme Design" --slug acme \
        --admin-email ada@acme.example --admin-name "Ada Okonkwo"

Creating an organization is an operator action rather than an API route: there
is no sign-up, so nobody outside this machine should be able to make a tenant.
The admin password is read from stdin, never from an argument, so it does not
land in shell history or the process list.
"""

import argparse
import asyncio
import getpass
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization, is_valid_slug
from app.models.user import User
from app.services.rbac import assign_role, seed_default_roles


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--name", required=True, help="Display name")
    parser.add_argument("--slug", required=True, help="Subdomain, e.g. acme")
    parser.add_argument("--admin-email", required=True)
    parser.add_argument("--admin-name", required=True)
    return parser.parse_args()


async def main() -> None:
    args = parse_args()
    slug = args.slug.strip().lower()

    if not is_valid_slug(slug):
        sys.exit(f"{slug!r} is not a usable subdomain (lowercase, hyphens, not reserved).")

    password = getpass.getpass("Password for the administrator: ")
    if len(password) < 12:
        sys.exit("Choose a password of at least 12 characters.")
    if password != getpass.getpass("Repeat it: "):
        sys.exit("The passwords do not match.")

    email = args.admin_email.strip().lower()

    async with AsyncSessionLocal() as session:
        existing = await session.execute(select(Organization).where(Organization.slug == slug))
        if existing.scalar_one_or_none() is not None:
            sys.exit(f"The subdomain {slug!r} is already taken.")

        organization = Organization(name=args.name.strip(), slug=slug)
        session.add(organization)
        await session.flush()

        seeded = await seed_default_roles(session, organization)
        roles = {role.slug: role for role in seeded}

        admin = User(
            organization_id=organization.id,
            email=email,
            full_name=args.admin_name.strip(),
            hashed_password=hash_password(password),
        )
        session.add(admin)
        await session.flush()

        await assign_role(session, user_id=admin.id, role=roles["organization-admin"])
        await session.commit()

    print(f"Created {organization.name!r} at {slug}.<your-domain>")
    print(f"  organization id: {organization.id}")
    print(f"  administrator:   {email}")


if __name__ == "__main__":
    asyncio.run(main())
