#!/bin/sh
# Bring the database up to date, put something in it the first time, and serve.
#
# Compose waits for PostgreSQL to be healthy before this runs, so there is no
# polling here — if the database is unreachable, that is a real failure and the
# container should say so rather than retry quietly.
set -e

echo "→ Applying migrations"
alembic upgrade head

# Only when there is nothing to lose. seed_demo deletes the demo tenant before
# recreating it, so running it on every start would throw away the work of
# anyone who had been using the workspace.
echo "→ Seeding, if this database is empty"
python -m scripts.seed_if_empty

echo "→ Starting the API on :8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir app
