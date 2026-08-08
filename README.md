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
| `projects`      | `status` (`planning`/`active`/`on_hold`/`completed`/`archived`), dates, `owner_id` and `created_by`. Both user references are SET NULL, so losing a person never deletes their projects, and a CHECK rejects an end date before its start. |

### Roles and permissions

| Table              | Notes                                                            |
| ------------------ | ---------------------------------------------------------------- |
| `roles`            | Per-organisation, so an admin can retune what "Team Lead" means for their tenant. The six built-ins are `is_system`: editable permissions, but not deletable or renameable. |
| `role_permissions` | One row per (role, feature) with `can_view` / `can_create` / `can_edit` / `can_delete` — exactly the checkbox grid in settings. |
| `user_roles`       | Many-to-many. A user can hold several roles at once; `project_id` scopes a grant to one project, or is NULL for organisation-wide. |

Built-in roles, seeded when an organisation is created:

| Role               | Scope        |
| ------------------ | ------------ |
| Organization Admin | Organisation |
| Project Manager    | Project      |
| Team Lead          | Project      |
| Member             | Project      |
| Client             | Project      |
| Viewer             | Project      |

Effective permissions are the **union** of every role that applies in context —
organisation-wide grants always count, project grants count only inside that
project. Roles can therefore only add access, never remove it.

Two rules are enforced rather than assumed:

- A permission cannot grant create, edit or delete without view. Checked in the
  database, in Pydantic and in the UI, so an inconsistent matrix cannot be saved.
- `user_roles` is unique on `(user_id, role_id, project_id)` with
  `NULLS NOT DISTINCT`, so a duplicate organisation-wide grant is rejected
  instead of silently allowed.

Edit the matrix at `/settings/roles`. Definitions live in
`backend/app/services/rbac.py`.

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

| Route              | Address                                     |
| ------------------ | ------------------------------------------- |
| Marketing home     | `localhost:3000`                            |
| Sign in            | `acme.localhost:3000/login`                 |
| Dashboard          | `acme.localhost:3000/dashboard`             |
| Permission matrix  | `/settings/roles`                           |
| API status         | `/status`                                   |

## Signing in

Sign-in is **per tenant**: each organisation has its own page on its own
subdomain, and credentials are only checked inside that organisation. There is
no sign-up — accounts are created by an administrator.

Locally, browsers resolve any `*.localhost` name to the loopback address, so
`acme.localhost:3000/login` works with no `/etc/hosts` entry. The subdomain the
page is served on decides the tenant; it is never taken from the form.
`NEXT_PUBLIC_ROOT_DOMAIN` sets the domain subdomains hang off.

After `npm run db:seed`, sign in as `ada@acme.test` with password `mentework`
(the script prints every demo account and its role).

How it works:

- Passwords are hashed with **argon2id**, and a correct password stored with
  outdated parameters is transparently rehashed on sign-in.
- The API returns a **JWT** carrying the organisation it was issued for. That
  claim is re-checked against the user's current organisation on every request,
  so a token cannot be replayed against another tenant.
- The token is exchanged for an **httpOnly cookie** by a Next.js route handler,
  so it never reaches client-side JavaScript. The cookie is set with no
  `Domain`, making it host-only — a session on one subdomain is never sent to
  another.
- Every sign-in failure returns one identical 401, and a throwaway hash runs on
  the miss paths, so an unknown workspace, an unknown address and a wrong
  password cannot be told apart by response or by timing.

`SECRET_KEY` defaults to an obvious placeholder and startup **fails** if that
placeholder is still set outside development. Generate one with
`openssl rand -hex 32`.

> **Still open:** the organisation and role endpoints have no authorisation
> checks yet — any signed-in user, or none, can call them. They need to be
> gated on the `roles` permission before this leaves a local machine. There is
> also no rate limiting on sign-in.

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
| `npm run db:seed`                      | Create the demo `acme` organisation with roles, projects and users |

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
