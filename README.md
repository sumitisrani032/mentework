# Mentework

Monorepo containing the Mentework web frontend and API backend.

## Stack

| Layer       | Technology                                     |
| ----------- | ---------------------------------------------- |
| Frontend    | Next.js 16 (App Router), TypeScript, Tailwind 4 |
| Backend     | Python 3.12, FastAPI, Pydantic v2               |
| Database    | PostgreSQL 16, SQLAlchemy 2 (asyncpg), Alembic  |
| Local infra | Docker Compose                                  |

## Layout

```
apps/
  web/   Next.js application
  api/   FastAPI application
```

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

The landing page calls the API health endpoint, so it shows `online` once both
processes are up.

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
