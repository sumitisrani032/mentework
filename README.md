# Mentework

A multi-tenant SaaS project-management workspace. Each customer organisation
gets its own subdomain and its own isolated data.

## Stack

| Layer       | Technology                                     |
| ----------- | ---------------------------------------------- |
| Frontend    | Next.js 16 (App Router), TypeScript, Tailwind 4 |
| Backend     | Python 3.12, FastAPI, Pydantic v2               |
| Database    | PostgreSQL 16, SQLAlchemy 2 (asyncpg), Alembic  |
| Local infra | Docker Compose                                  |

## Layout

```
frontend/   Next.js application
backend/    FastAPI application
```

## Data model

`Organization` is the root of the model — the tenant. Every other record
belongs to exactly one organisation.

| Table           | Notes                                                              |
| --------------- | ------------------------------------------------------------------ |
| `organizations` | `slug` is the subdomain. A CHECK constraint keeps it DNS-safe, and `RESERVED_SLUGS` blocks names like `www` and `api`. |
| `users`         | Scoped to one organisation. `(organization_id, email)` is unique, so the same address can exist in several tenants. Deleting an organisation cascades. |

Roles are currently a provisional `owner` / `admin` / `member` / `guest` set on
`users.role`, stored as `VARCHAR(32)` with a CHECK constraint generated from the
`UserRole` enum. Adding or renaming a role is an ordinary migration — see
`backend/app/models/user.py`. The full permission matrix is still to come.

## Prerequisites

- Node.js 20+
- Python 3.12+
- Docker
- [uv](https://docs.astral.sh/uv/) for the Python environment: `curl -LsSf https://astral.sh/uv/install.sh | sh`

## Getting started

```bash
cp .env.example .env                  # database + API settings
cp frontend/.env.example frontend/.env.local   # web settings

npm install       # JavaScript dependencies
npm run setup:api # create backend/.venv and install Python dependencies
npm run db:up     # start PostgreSQL
npm run dev       # run web and api together
```

- Web: http://localhost:3000
- API: http://localhost:8000 (interactive docs at `/docs`)

`/` is the marketing home page and `/status` shows live API health.

### Theming

Light and dark are driven by `next-themes`, which sets a `.dark` class on
`<html>`. Colours are CSS custom properties in `frontend/src/app/globals.css`,
re-exported to Tailwind through `@theme` — so change a token there and both the
utilities and the components follow. The default is the visitor's system
setting.

### Marketing copy

All wording lives in `frontend/src/lib/content.ts`. The testimonials there are
placeholders with fictional names; replace them with real, attributable quotes
before launch. The hero deliberately carries product terms rather than G2 or
Capterra badges, since those have to be earned before they can be shown.

### A note on ports

The PostgreSQL container listens on **5433**, not the default 5432, so it does
not collide with a PostgreSQL installed on the host. Change `POSTGRES_PORT` and
`DATABASE_URL` in `.env` if you want something else.

## Common tasks

| Command                                | Purpose                                        |
| -------------------------------------- | ---------------------------------------------- |
| `npm run dev`                          | Run web and api together                       |
| `npm run build`                        | Production build of the web app                |
| `npm run lint`                         | ESLint on web, ruff on api                     |
| `npm test`                             | pytest for the api                             |
| `npm run db:up` / `npm run db:down`    | Start / stop PostgreSQL                        |
| `npm run db:migrate`                   | Apply migrations (`alembic upgrade head`)      |
| `npm run db:revision -- "add users"`   | Autogenerate a migration from model changes    |

## Environment files

`.env` at the repository root configures Docker Compose and the API. Next.js
only reads env files from its own directory, so web settings live in
`frontend/.env.local`. Both have a committed `.env.example` to copy from;
neither `.env` file is committed.

## Migrations

Models live in `backend/app/models/`. Import each new model module in
`app/models/__init__.py` so Alembic autogenerate sees it, then:

```bash
npm run db:revision -- "add users table"
npm run db:migrate
```

Alembic reads the database URL from the app settings rather than `alembic.ini`,
so credentials stay in `.env`.
