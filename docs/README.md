# Mentework documentation

Everything here is written from the code as it stands, not from a plan. Where a
feature is designed but not built, it says so.

## Start here

| If you want to… | Read |
| --- | --- |
| Get the project running on your machine | [Local setup](local-setup.md) |
| Sign in and look around | [Demo accounts](demo-accounts.md) |
| Understand how the pieces fit together | [Architecture](architecture.md) |
| Call the API | [API reference](api-reference.md) |
| Understand the tables and their columns | [Database](database.md) |
| Understand who can do what | [Authorization](authorization.md) |
| Know what is built and what is not | [Features](features.md) |

## The project in one paragraph

Mentework is a multi-tenant SaaS project-management workspace. Each customer
organisation gets its own subdomain (`acme.mentework.com`) and its own isolated
data. Inside an organisation, people hold roles, roles carry a permission
matrix, and a role can be granted organisation-wide or scoped to one project.
The part built out furthest is time tracking: projects hold timesheets,
timesheets hold logged time, and a month can be bulk-uploaded from a CSV.

## The numbers

| | Count |
| --- | --- |
| HTTP endpoints | 32 |
| Database tables | 9 (plus `alembic_version`) |
| Migrations | 8 |
| Built-in roles | 6 |
| Permission features | 13 |
| Backend tests | 199 |
| Demo accounts | 12 |

## Conventions this codebase holds to

- **Dates are `DD/MM/YYYY` everywhere they are displayed.** One helper,
  `formatDate`, feeds every screen.
- **The browser never talks to the API directly.** It calls Next.js route
  handlers, which forward to FastAPI server-side. See [Architecture](architecture.md).
- **Row keys stay on the server.** Projects and timesheets are addressed
  publicly by UUID; the `BIGINT` primary keys never appear in a URL or a
  response body. See [Database](database.md#two-kinds-of-identifier).
- **Authorisation is checked per request**, never inferred from knowing an id.
