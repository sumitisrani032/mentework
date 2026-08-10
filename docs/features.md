# Features

What exists, what is scaffolded, and what is only a permission row waiting for
a feature. The navigation carries a `built` flag for exactly this reason —
unbuilt sections render as "soon" rather than as links that go nowhere.

## Status at a glance

| Area | Status |
| --- | --- |
| Authentication and tenancy | **Built** |
| Roles and permissions | **Built** |
| People management | **Built** |
| Projects | **Built** |
| Time tracking | **Built** — the deepest area |
| CSV bulk upload | **Built** |
| The Me page | **Partly** — real data in two widgets |
| Tasks, Gantt, Calendar, Discussions, Files, Reports, Billing | **Not built** — permissions exist, screens do not |

## Built

### Authentication and tenancy
Subdomain-per-tenant, argon2id passwords, 12-hour JWT in an httpOnly cookie.
No sign-up: accounts are created by an administrator or `npm run org:create`.
The subdomain decides the tenant and is never taken from the form.

### Roles and permissions
The full matrix — 13 features × 4 actions — editable per organisation in
Settings → Roles. Six built-in roles are seeded per tenant; their permissions
can be retuned but they cannot be deleted or renamed. Custom roles can be
created and deleted, except when a role is the last way into the matrix.

See [Authorization](authorization.md).

### People
Create an account with a role, scoped organisation-wide or to specific
projects. Deactivate and restore, or delete outright. Grant and revoke roles
individually. Guarded so a workspace can never lose its last administrator.

### Projects
Create with name, key, description, status, and start/end dates. Listing shows
only what your roles reach. Creating one also grants the creator a
project-scoped Project Manager role, so a project is never invisible to its
author.

Status: `planning`, `active`, `on_hold`, `completed`, `archived`.

### Time tracking
The most complete area.

- **Timesheets** per project, with an estimate, a private flag and an archived
  flag. Private ones are visible only to their assignees and to managers.
- **Time entries** with date, hours and minutes, description, and a billing
  status (`none`, `billable`, `billed`). Stored as one minute total, so
  "1h 90m" cannot exist.
- **Add time** and **Bulk upload time** behind a single Add menu.
- **Filtering** by date range, status and person; grouping by date or person;
  ordering either way. Filters live in the URL, so a filtered month is
  shareable and survives a reload.
- **Summary panel** of estimated, logged, billed, billable and non-billable
  time, beside the entries.
- **Editing and deleting** inline, gated on whose entry it is.

### CSV bulk upload
A month at a time, validated before anything is written.

| Column | Accepts |
| --- | --- |
| `date` | `05/10/2026` day-first, or ISO `2026-10-05` |
| `logged_hours` | `1:40` (h:mm) or `1.5` (decimal) |
| `logged_minutes` | whole number under 60, adds to the hours |
| `description` | free text |
| `status` | `none`, `billable`, `billed` |

Header spellings are forgiving (`day`, `hours`, `notes`, `billing` all work),
and Excel's byte-order mark is handled.

Rules: at most **31 rows of time**; one bad row rejects the whole file with a
list of every problem; a dry run previews before anything is saved;
re-uploading the same file skips rows already logged unless forced.

### The Me page
Real data in **My projects** and **My logged time**. The remaining widgets —
Announcements, Agenda, My tasks, and most shortcuts — are laid out and marked
"soon" rather than filled with plausible-looking nothing.

## Not built

These have permission rows and navigation entries, so a role can already be
granted access to them. The screens do not exist yet.

| Feature | Permission exists | Screen |
| --- | --- | --- |
| Tasks | yes | no |
| Gantt | yes | no |
| Calendar | yes | no |
| Discussions | yes | no |
| Files | yes | no |
| Reports | yes | no |
| Billing | yes | no |
| Settings (general) | yes | partly — Roles and Members exist |

Permissions were modelled ahead of the screens deliberately: the matrix is the
product's shape, and adding a feature later should not mean redesigning how
access to it is granted.

## Product conventions

- **Dates display as `DD/MM/YYYY`** everywhere, from one `formatDate` helper.
- **Durations** display as `2h 30m`, `45m`, `3h`.
- **Nothing half-applies.** The CSV import is all-or-nothing; role changes are
  refused rather than partly performed.
- **Hidden, not disabled.** Actions you cannot perform are not rendered — but
  the API re-checks regardless.
- **404 over 403** wherever a 403 would confirm that a row exists.
