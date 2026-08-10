# API reference

**32 endpoints**, all under `/api/v1`. Generated documentation is served live:

| | |
| --- | --- |
| Swagger UI | <http://localhost:8000/docs> |
| ReDoc | <http://localhost:8000/redoc> |
| OpenAPI JSON | <http://localhost:8000/openapi.json> |

Those are generated from the code and are always current. This page is the
narrative version — what the groups are for and which rules apply across them.

## Two API layers

Do not confuse them:

| Layer | Base | Called by | Auth |
| --- | --- | --- | --- |
| Next.js route handlers | `/api/…` | The browser | httpOnly session cookie |
| FastAPI | `/api/v1/…` | The Next.js server | `Authorization: Bearer` |

The browser never calls `/api/v1` directly. Everything below describes the
FastAPI layer; the Next.js layer is a thin proxy that attaches the session.

## Authentication

`POST /api/v1/auth/login` returns a JWT valid for **12 hours**, signed HS256,
carrying `sub` (user id), `org` (organisation id), `slug` and `exp`. Send it as
`Authorization: Bearer <token>` on every other call.

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ada@acme.test","password":"mentework","organization_slug":"acme"}' \
  | python3 -c "import json,sys; print(json.load(sys.stdin)['access_token'])")

curl -s http://localhost:8000/api/v1/projects -H "Authorization: Bearer $TOKEN"
```

## Identifiers

Projects and timesheets are addressed by **public id (UUID)**, in paths, in
request bodies and in responses. The `id` field of a project or timesheet *is*
its public id.

```
GET /api/v1/projects/8181acf1-f89b-435a-82ce-4f0727cdfb92/timesheets   200
GET /api/v1/projects/3/timesheets                                      422
```

The `422` is FastAPI rejecting a value that is not a UUID — a row key never
reaches a lookup. Users, roles, role assignments and time entries are still
addressed by their integer ids.

## Endpoints

### Health — 2

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/health` | Liveness probe |
| GET | `/health/db` | Readiness probe — checks the database |

### Auth — 3

| Method | Path | Summary |
| --- | --- | --- |
| POST | `/auth/login` | Sign in to a workspace |
| GET | `/auth/me` | Read the signed-in user |
| GET | `/auth/organizations/{slug}` | Look up a tenant for its sign-in page |

`/auth/organizations/{slug}` is the one endpoint keyed by slug rather than id —
the login page needs the tenant before anyone is signed in.

### Me — 3

| Method | Path | Summary |
| --- | --- | --- |
| PATCH | `/me/profile` | Change your own details |
| POST | `/me/password` | Change your own password |
| GET | `/me/time` | Time you logged, across every project |

Everything here acts on the caller. No permission is needed to change your own
name or password.

### Organizations — 2

| Method | Path | Summary |
| --- | --- | --- |
| GET | `/organizations/me` | Read your own organization |
| GET | `/organizations/{organization_id}` | Read an organization |

### Projects — 3

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/projects` | `projects.view` |
| POST | `/projects` | `projects.create` |
| GET | `/projects/{project_id}/permissions` | `projects.view` |

`/permissions` answers "what may *I* do in this project", so the interface can
hide actions that would only fail. It reports nothing about anyone else.

Creating a project also grants the creator a project-scoped Project Manager
role — not politeness, necessity: access is project-scoped, so a project nobody
holds a role on is invisible the moment it is created.

### Timesheets and time — 9

All nested under `/projects/{project_id}/timesheets`.

| Method | Path | Permission |
| --- | --- | --- |
| GET | `` | `timesheet.view` |
| POST | `` | `timesheet.create` |
| GET | `/import-template` | `timesheet.view` |
| GET | `/{timesheet_id}` | `timesheet.view` |
| GET | `/{timesheet_id}/time` | `timesheet.view` |
| POST | `/{timesheet_id}/time` | `time_entry.create` |
| POST | `/{timesheet_id}/time/import` | `time_entry.create` |
| PATCH | `/{timesheet_id}/time/{entry_id}` | `time_entry.edit` |
| DELETE | `/{timesheet_id}/time/{entry_id}` | `time_entry.delete` |

**`timesheet` and `time_entry` are separate permissions on purpose.** Managing a
timesheet — creating, renaming, archiving — is a manager's job. Filling one in
is everyone's. A Member holds `time_entry` but not `timesheet.create`.

Two further rules the routes apply beyond the permission:

- A **private** timesheet is invisible to anyone who is not an assignee, unless
  they hold `timesheet.delete` (the manage-level grant). It returns **404, not
  403** — a 403 would confirm it exists.
- Editing or deleting **someone else's** entry needs `time_entry.delete`.
  Holding only `edit` lets you correct your own.

Import accepts `?dry_run=true` to validate without writing, and
`?allow_duplicates=true` to force rows that match time already logged.

### Roles — 4

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/roles` | `roles.view` |
| POST | `/roles` | `roles.create` |
| PUT | `/roles/{role_id}/permissions` | `roles.edit` |
| DELETE | `/roles/{role_id}` | `roles.delete` |

Two refusals are built in:

- **Built-in roles cannot be deleted or renamed.** Their permissions are
  editable, so a tenant can retune what "Team Lead" means.
- **The last route into the matrix cannot be removed.** Deleting a role takes
  its grants with it, so removing the only one carrying `roles` would leave a
  workspace nobody can administer.

### Users and grants — 6

| Method | Path | Permission |
| --- | --- | --- |
| GET | `/users` | `members.view` |
| POST | `/users` | `members.create` |
| PATCH | `/users/{user_id}` | `members.delete` |
| DELETE | `/users/{user_id}` | `members.delete` |
| POST | `/users/{user_id}/roles` | `roles.edit` |
| DELETE | `/users/{user_id}/roles/{assignment_id}` | `roles.edit` |

`PATCH /users/{id}` deactivates or restores; `DELETE` removes the account for
good. Both sit behind `members.delete`, not `edit` — taking someone out of the
workspace ends their access everywhere, so it is treated as the delete-level
right even though the row survives.

The same "cannot orphan role management" rule applies here — the last person who
can administer roles cannot be deactivated, deleted, or have that grant removed.
Deactivation is checked because it ends access on every request, not just at
sign-in.

`POST /users/{user_id}/roles` takes the **project's public id** in
`project_id`, since that body comes from a browser.

## Errors

| Status | Means |
| --- | --- |
| 400 | The request was understood and refused, with a reason |
| 401 | No token, or an expired or malformed one |
| 403 | Signed in, permission missing |
| 404 | No such row — *or* one deliberately hidden |
| 409 | Conflicts with something that exists |
| 422 | Failed validation, including a malformed UUID |

Bodies carry `detail`, either a string or FastAPI's validation list.

The CSV import is the exception: it rejects with a **list** of problems, each
with its row and column, so a whole file can be fixed in one pass rather than
one error per upload.

```json
{
  "message": "3 rows could not be read",
  "errors": [
    { "row": 3, "column": "date", "message": "'32/13/2026' is not a date; use DD/MM/YYYY, e.g. 05/10/2026" },
    { "row": 4, "column": "logged_hours", "message": "'abc' is not a duration; use 1:40 (hours:minutes) or 1.5 (decimal hours)" }
  ]
}
```

## 404 versus 403

Where a 403 would confirm that a row exists, the API returns 404 instead. This
is deliberate and applies to:

- a project in another organisation,
- a private timesheet the caller is not assigned to,
- a time entry in a timesheet they cannot see.

So a 404 means "not found *or* not yours", and the two are not distinguishable
from outside. That is the point.
