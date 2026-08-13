"""Seed a database that has nothing in it yet, and leave any other alone.

`npm run db:seed` deletes the demo tenant before recreating it, which is the
right behaviour when you ask for it and the wrong behaviour on every container
start. This checks first, so a fresh `docker compose up` arrives with something
to sign in to and a second one leaves the workspace as you left it.

Run with `python -m scripts.seed_if_empty`, or not at all — the container
entrypoint calls it.
"""

import asyncio
import sys

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.session import AsyncSessionLocal
from app.models.organization import Organization
from scripts import seed_demo, seed_storefront_july


async def main() -> None:
    settings = get_settings()
    if not settings.is_development:
        sys.exit(f"Refusing to seed: ENVIRONMENT is {settings.environment!r}, not development.")

    async with AsyncSessionLocal() as session:
        organizations = await session.scalar(select(func.count()).select_from(Organization))

    if organizations:
        print(f"  {organizations} organization(s) already here — leaving the database alone.")
        return

    print("  Empty database. Creating the demo workspace.")
    await seed_demo.main()
    await seed_storefront_july.main()


if __name__ == "__main__":
    asyncio.run(main())
