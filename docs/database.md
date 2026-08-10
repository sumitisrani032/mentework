# Database

PostgreSQL 16, accessed through SQLAlchemy 2 with asyncpg. Schema is owned by
Alembic — 8 migrations, `backend/alembic/versions/`.

Nine application tables, plus Alembic's own `alembic_version`.

## Entity relationships

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ USERS : "employs"
    ORGANIZATIONS ||--o{ PROJECTS : "owns"
    ORGANIZATIONS ||--o{ ROLES : "defines"
    ROLES ||--o{ ROLE_PERMISSIONS : "grants"
    ROLES ||--o{ USER_ROLES : "assigned via"
    USERS ||--o{ USER_ROLES : "holds"
    PROJECTS ||--o{ USER_ROLES : "scopes"
    PROJECTS ||--o{ TIMESHEETS : "contains"
    TIMESHEETS ||--o{ TIME_ENTRIES : "collects"
    TIMESHEETS ||--o{ TIMESHEET_ASSIGNEES : "shared with"
    USERS ||--o{ TIMESHEET_ASSIGNEES : "assigned to"
    USERS ||--o{ TIME_ENTRIES : "logs"
    USERS ||--o{ TIMESHEETS : "creates"
    USERS ||--o{ PROJECTS : "owns"

    ORGANIZATIONS {
        bigint id PK
        varchar(120) name
        varchar(63) slug UK "the subdomain"
        boolean is_active
        timestamptz created_at
        timestamptz updated_at
    }
    USERS {
        bigint id PK
        bigint organization_id FK
        varchar(320) email "unique per organisation"
        varchar(120) full_name
        varchar(255) hashed_password "argon2id, nullable"
        boolean is_active
        timestamptz last_login_at
    }
    PROJECTS {
        bigint id PK
        uuid public_id UK "what URLs use"
        bigint organization_id FK
        varchar(160) name
        varchar(16) key "unique per organisation"
        text description
        varchar(32) status
        date start_date
        date end_date
        bigint owner_id FK
        bigint created_by FK
    }
    ROLES {
        bigint id PK
        bigint organization_id FK
        varchar(80) name
        varchar(64) slug "unique per organisation"
        varchar(255) description
        varchar(32) scope "organization or project"
        boolean is_system
    }
    ROLE_PERMISSIONS {
        bigint id PK
        bigint role_id FK
        varchar(32) feature
        boolean can_view
        boolean can_create
        boolean can_edit
        boolean can_delete
    }
    USER_ROLES {
        bigint id PK
        bigint user_id FK
        bigint role_id FK
        bigint project_id FK "NULL means organisation-wide"
    }
    TIMESHEETS {
        bigint id PK
        uuid public_id UK
        bigint project_id FK
        varchar(200) title
        integer estimated_minutes
        boolean is_private
        boolean is_archived
        bigint creator_id FK
    }
    TIME_ENTRIES {
        bigint id PK
        bigint timesheet_id FK
        date entry_date
        integer logged_minutes
        varchar(32) status
        text description
        boolean from_timer
        bigint creator_id FK
    }
    TIMESHEET_ASSIGNEES {
        bigint timesheet_id PK-FK
        bigint user_id PK-FK
    }
```

## Two kinds of identifier

Every table has a sequential `BIGINT` primary key. It is the join key and it
never leaves the server.

`projects` and `timesheets` carry a second identifier, `public_id`, a **UUIDv4**
with a unique index. That is what appears in URLs, query strings and response
bodies. The API's `id` field *is* the public id — the row key has no path out.

Why both:

- A `BIGINT` key is small, fast to join, and readable in psql.
- A sequential key in a URL is walkable (`/projects/1`, `/projects/2`) and
  leaks row counts and creation order.
- **v4 specifically.** A time-ordered UUID (v1, v7) sorts by creation time and
  would hand back the ordering this exists to hide.

`public_id` is defaulted twice — `default=uuid.uuid4` for the ORM and
`server_default gen_random_uuid()` for raw SQL, seeds and imports.

`time_entries` has no public id. It is the growth table, a unique index on
random UUIDs scatters its writes, and an entry id means nothing without access
to the project holding it.

## Column reference

Every table also has `created_at` and `updated_at` (`timestamptz`, `NOT NULL`,
default `now()`), except `timesheet_assignees`.

### `organizations`
The tenant. Root of the model.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK, sequence |
| `name` | `varchar(120)` | no | |
| `slug` | `varchar(63)` | no | The subdomain. DNS-safe by CHECK |
| `is_active` | `boolean` | no | default `true` |

`ck_organizations_slug_format` enforces `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` in the
database, so a slug that could not resolve as DNS cannot be stored. `RESERVED_SLUGS`
blocks names like `www` and `api` in the application.

### `users`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `organization_id` | `bigint` | no | FK → `organizations`, CASCADE |
| `email` | `varchar(320)` | no | Lowercased on write |
| `full_name` | `varchar(120)` | no | |
| `hashed_password` | `varchar(255)` | yes | argon2id |
| `is_active` | `boolean` | no | default `true` |
| `last_login_at` | `timestamptz` | yes | |

`uq_users_organization_id_email` — the same address can exist in several
tenants, which it must, because tenants are separate customers.

### `projects`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `public_id` | `uuid` | no | Unique. What URLs use |
| `organization_id` | `bigint` | no | FK → `organizations`, CASCADE |
| `name` | `varchar(160)` | no | |
| `key` | `varchar(16)` | no | Short code, e.g. `STO` |
| `description` | `text` | yes | |
| `status` | `varchar(32)` | no | `planning` \| `active` \| `on_hold` \| `completed` \| `archived` |
| `start_date` | `date` | yes | |
| `end_date` | `date` | yes | |
| `owner_id` | `bigint` | yes | FK → `users`, SET NULL |
| `created_by` | `bigint` | yes | FK → `users`, SET NULL |

Both user references are SET NULL, so removing a person never deletes their
projects. `ck_projects_end_after_start` rejects an end date before its start.
`uq_projects_org_key` makes the key unique per organisation.

### `roles`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `organization_id` | `bigint` | no | FK → `organizations`, CASCADE |
| `name` | `varchar(80)` | no | |
| `slug` | `varchar(64)` | no | Unique per organisation |
| `description` | `varchar(255)` | yes | |
| `scope` | `varchar(32)` | no | `organization` \| `project` |
| `is_system` | `boolean` | no | Built-ins: editable, not deletable |

Roles are per-organisation, so an admin can retune what "Team Lead" means in
their own tenant without affecting anyone else.

### `role_permissions`
One row per (role, feature) — literally the checkbox grid in settings.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `role_id` | `bigint` | no | FK → `roles`, CASCADE |
| `feature` | `varchar(32)` | no | One of the 13 features |
| `can_view` | `boolean` | no | default `false` |
| `can_create` | `boolean` | no | default `false` |
| `can_edit` | `boolean` | no | default `false` |
| `can_delete` | `boolean` | no | default `false` |

`ck_role_permissions_view_implied`:

```sql
CHECK (can_view OR NOT (can_create OR can_edit OR can_delete))
```

You cannot hold create, edit or delete without view. The database refuses the
nonsense state rather than trusting every caller to avoid it.

### `user_roles`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `user_id` | `bigint` | no | FK → `users`, CASCADE |
| `role_id` | `bigint` | no | FK → `roles`, CASCADE |
| `project_id` | `bigint` | yes | FK → `projects`, CASCADE. NULL = organisation-wide |

`uq_user_roles_user_role_project` is declared `NULLS NOT DISTINCT`:

```sql
UNIQUE NULLS NOT DISTINCT (user_id, role_id, project_id)
```

That covers organisation-wide grants too. Under the default `NULLS DISTINCT`,
two rows with a NULL `project_id` compare unequal, so the same organisation-wide
grant could be written twice. Requires PostgreSQL 15+.

### `timesheets`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `public_id` | `uuid` | no | Unique |
| `project_id` | `bigint` | no | FK → `projects`, CASCADE |
| `title` | `varchar(200)` | no | |
| `estimated_minutes` | `integer` | yes | Stored as one total |
| `is_private` | `boolean` | no | Private → only assignees see it |
| `is_archived` | `boolean` | no | Archived → takes no new time |
| `creator_id` | `bigint` | yes | FK → `users`, SET NULL |

### `time_entries`

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `id` | `bigint` | no | PK |
| `timesheet_id` | `bigint` | no | FK → `timesheets`, CASCADE |
| `entry_date` | `date` | no | |
| `logged_minutes` | `integer` | no | One total, never hours + minutes |
| `status` | `varchar(32)` | no | `none` \| `billable` \| `billed` |
| `description` | `text` | yes | |
| `from_timer` | `boolean` | no | Recorded with a timer rather than typed |
| `creator_id` | `bigint` | yes | FK → `users`, SET NULL |

Durations are stored as a **single minute total**, so "1h 90m" cannot be
persisted. The API speaks hours and minutes and converts at the edge.

### `timesheet_assignees`
Join table. Who a private timesheet is shared with.

| Column | Type | Null | Notes |
| --- | --- | --- | --- |
| `timesheet_id` | `bigint` | no | PK + FK → `timesheets`, CASCADE |
| `user_id` | `bigint` | no | PK + FK → `users`, CASCADE |

No surrogate key: the pair *is* the identity, which gets uniqueness for free.

## Constraints at a glance

| Constraint | Table | Type | Enforces |
| --- | --- | --- | --- |
| `ck_organizations_slug_format` | organizations | CHECK | Slug is DNS-safe |
| `uq_users_organization_id_email` | users | UNIQUE | One address per tenant |
| `uq_projects_org_key` | projects | UNIQUE | One key per tenant |
| `ck_projects_status_valid` | projects | CHECK | Status is a known value |
| `ck_projects_end_after_start` | projects | CHECK | Dates run forwards |
| `uq_roles_organization_id_slug` | roles | UNIQUE | One role slug per tenant |
| `ck_roles_scope_valid` | roles | CHECK | Scope is a known value |
| `uq_role_permissions_role_id_feature` | role_permissions | UNIQUE | One row per feature |
| `ck_role_permissions_feature_valid` | role_permissions | CHECK | Feature is a known value |
| `ck_role_permissions_view_implied` | role_permissions | CHECK | No acting without seeing |
| `uq_user_roles_user_role_project` | user_roles | UNIQUE | No duplicate grants |
| `ck_timesheets_estimate_not_negative` | timesheets | CHECK | Estimate ≥ 0 |
| `ck_time_entries_logged_positive` | time_entries | CHECK | Logged time > 0 |
| `ck_time_entries_status_valid` | time_entries | CHECK | Status is a known value |

## Migrations

| Order | Revision | What |
| --- | --- | --- |
| 1 | `84915c0b9d56` | organizations and users |
| 2 | `c359ff3b4de8` | RBAC: roles, permissions, assignments |
| 3 | `2f432e8a2b37` | project attributes |
| 4 | `a593315a0b83` | timesheets and time entries |
| 5 | `c41d7f0a9e52` | split logging time out of the timesheet permission |
| 6 | `d8a1c2f47b60` | Member may correct their own time |
| 7 | `e5b93c1a7d24` | Team Lead may log and correct time |
| 8 | `c6d4218b0f8d` | public ids on projects and timesheets |
