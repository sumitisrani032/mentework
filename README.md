# Mentework

Monorepo containing the Mentework web frontend and API backend.

## Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | Next.js (App Router), TypeScript, Tailwind  |
| Backend  | Python, FastAPI, Pydantic                   |
| Database | PostgreSQL 16, SQLAlchemy 2, Alembic        |
| Local infra | Docker Compose                           |

## Layout

```
apps/
  web/   Next.js application
  api/   FastAPI application
```

## Getting started

Prerequisites: Node.js 20+, Python 3.12+, Docker.

```bash
cp .env.example .env
docker compose up -d      # start PostgreSQL
npm install               # install workspace dependencies
npm run dev               # run web and api together
```

The web app runs on http://localhost:3000 and the API on http://localhost:8000
(interactive docs at http://localhost:8000/docs).
