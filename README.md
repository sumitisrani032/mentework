# Mentework

A multi-tenant SaaS project-management workspace. Each customer organisation
gets its own subdomain and its own isolated data.

## Documentation

This file is the tour. [`docs/`](docs/README.md) is the reference.

| | |
| --- | --- |
| [Local setup](docs/local-setup.md) | Prerequisites, commands, troubleshooting |
| [Demo accounts](docs/demo-accounts.md) | The 12 seeded logins and what each one shows |
| [Architecture](docs/architecture.md) | How the pieces fit, with sequence and flow diagrams |
| [API reference](docs/api-reference.md) | All 32 endpoints, grouped, with the rules across them |
| [Database](docs/database.md) | ERD, every column and type, every constraint |
| [Authorization](docs/authorization.md) | Roles, the permission matrix, how a check runs |
| [Features](docs/features.md) | What is built, what is not |

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

## Authorization

Every endpoint outside sign-in requires a session **and** the matching
permission from the role matrix. Nothing is keyed to a role's name — change the
grid and access changes with it.

| Endpoint                        | Requires                         |
| ------------------------------- | -------------------------------- |
| `GET /roles`                    | `roles` · view                   |
| `POST /roles`                   | `roles` · create                 |
| `PUT /roles/{id}/permissions`   | `roles` · edit                   |
| `DELETE /roles/{id}`            | `roles` · delete                 |
| `POST /users/{id}/roles`        | `roles` · edit                   |
| `GET /organizations/me`         | any session                      |
| `.../timesheets` (read)         | `timesheet` · view **in that project** |
| `.../timesheets` (write)        | `timesheet` · create **in that project** |
| `PATCH .../time/{id}`           | `timesheet` · edit, plus ownership |
| `DELETE .../time/{id}`          | `timesheet` · delete             |

Two rules run through all of it:

- **Organisation features cannot be unlocked by a project role.** A grant
  scoped to one project never confers `roles`, `billing` or `settings`,
  so being an admin of a single project does not hand over the organisation.
- **Anything you may not see is reported as missing, not forbidden.** Another
  tenant's role, project or organisation returns 404, so ids cannot be probed.

There is deliberately **no route that lists or creates organisations** —
enumerating tenants should be impossible, and provisioning is an operator
action:

```bash
npm run org:create -- --name "Acme Design" --slug acme \
    --admin-email ada@acme.example --admin-name "Ada Okonkwo"
```

The password is read from stdin, so it never reaches shell history.

> **Still open:** no rate limiting on sign-in.

## Timesheets

A timesheet is a named bucket of time inside a project; time entries hang off
it.

```
GET  /api/v1/projects/{project_id}/timesheets
POST /api/v1/projects/{project_id}/timesheets
GET  /api/v1/projects/{project_id}/timesheets/{timesheet_id}
GET  /api/v1/projects/{project_id}/timesheets/{timesheet_id}/time
POST /api/v1/projects/{project_id}/timesheets/{timesheet_id}/time
```

Two decisions worth knowing:

- **Time is stored as a single minute total**, not as separate hours and
  minutes. The API still speaks `logged_hours` / `logged_mins`, but "1h 90m"
  can never be persisted, and summing is trivial. Minutes above 59 are rejected.
- **Only the estimate is stored.** `logged_*`, `billable_*` and `billed_*` are
  summed from the entries on read, so a timesheet's totals can never disagree
  with the time logged against it.

Private timesheets are visible only to their creator, their assignees, and
anyone whose role can *delete* timesheets — otherwise an administrator could
not audit time they did not log themselves.

### Changing logged time

```
PATCH  /api/v1/projects/{project_id}/timesheets/{timesheet_id}/time/{entry_id}
DELETE /api/v1/projects/{project_id}/timesheets/{timesheet_id}/time/{entry_id}
```

`PATCH` is partial: only fields present in the body are applied, so omitting
`description` leaves it alone while sending it as `null` clears it.

Two rules decide who may act on an entry:

- The matrix decides **what** you can do: `timesheet` edit to change an entry,
  `timesheet` delete to remove one.
- Ownership decides **whose**. You may always act on time you logged yourself.
  Touching someone else's additionally needs the `timesheet` delete grant — the
  same manage-level signal that reveals private timesheets — so an ordinary
  member cannot quietly rewrite a colleague's hours.

With the defaults that means a **Member can correct their own entries but not
delete them, and cannot touch anyone else's**; a **Project Manager can do both,
for anyone on their project**. To let members delete their own time, tick
Delete for `timesheet` on the Member role at `/settings/roles` — no code change
needed.

### Bulk upload

**`/timesheets`** lists the projects you can see, the timesheets in each, and
the time already logged against the selected one. "New timesheet" creates one;
the upload panel takes a whole month at once. Both appear only if your role can
create timesheets *in that project* — the page asks
`GET /projects/{id}/permissions` rather than offering buttons that would 403.

Four columns:

```csv
date,logged_hours,description,status
2026-08-03,1:40,Brainstorm session,billable
2026-08-04,2.5,Onboarding emails,none
2026-08-05,0:30,Standup,billed
```

```
GET  /api/v1/projects/{project_id}/timesheets/import-template
POST /api/v1/projects/{project_id}/timesheets/{timesheet_id}/time/import
       ?dry_run=true          validate without saving
       ?allow_duplicates=true log rows that match time already recorded
```

Only `date` and `logged_hours` are required; `description` is optional and a
blank `status` becomes `none`. Common header spellings (`Logged Hours`, `hours`,
`notes`, `billing`) are accepted, the byte-order mark Excel writes is stripped,
and blank lines are ignored.

The page always runs a `dry_run` first and shows every parsed row before
anything is written, so a file is never applied unseen.

Four decisions that shape how it behaves:

- **One bad row rejects the whole file.** You get every problem back at once,
  addressed by row and column. A half-imported month is far harder to unpick
  than one that never landed.
- **Re-uploading the same file does not double-count.** Rows matching time you
  already logged are skipped and counted in `skipped_duplicates`. Pass
  `allow_duplicates=true` when the repetition is real.
- **Dates must be `YYYY-MM-DD`.** `05/10/2026` is refused rather than guessed
  at — it means two different days either side of the Atlantic, and choosing
  wrong would silently misfile a month of work. Future dates are refused too.
- **Durations are `1:40` or `1.5`, and a bare number is hours.** `90m` is
  refused rather than read as 90 hours.

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
| `npm run org:create -- --help`         | Provision a new tenant and its first administrator |

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
