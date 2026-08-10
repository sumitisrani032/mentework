# Architecture

## The pieces

```mermaid
flowchart LR
    B["Browser<br/>acme.localhost:3000"]
    N["Next.js server<br/>:3000<br/>pages + route handlers"]
    F["FastAPI<br/>:8000<br/>/api/v1"]
    D[("PostgreSQL 16<br/>:5433")]

    B -->|"relative fetch<br/>/api/…"| N
    N -->|"apiFetch, server-side<br/>bearer token"| F
    F -->|"SQLAlchemy 2, asyncpg"| D

    style B fill:#e8f0fe,stroke:#4285f4,color:#111
    style N fill:#e6f4ea,stroke:#34a853,color:#111
    style F fill:#fce8e6,stroke:#ea4335,color:#111
    style D fill:#fef7e0,stroke:#fbbc04,color:#111
```

**The browser never calls FastAPI.** Every client-side `fetch` uses a relative
path to a Next.js route handler, which forwards to the API from the server with
the session attached. Both `lib/session.ts` and `lib/api.ts` are server-only —
they import `next/headers` and `next/server` respectively.

Two consequences worth knowing:

- The API bearer token lives in an **httpOnly cookie**. Client JavaScript cannot
  read it, and the token never reaches the browser as a value.
- What a user can observe in DevTools is the `/api/*` layer, not `/api/v1/*`.
  FastAPI is still reachable directly on `:8000` in development — "not visible"
  is not "not reachable".

## Layout

```
frontend/            Next.js 16, App Router, TypeScript, Tailwind 4
  src/app/           routes — pages and route handlers
  src/components/    UI, grouped by area
  src/lib/           data access, formatting, session
backend/             FastAPI, Python 3.12
  app/api/routes/    endpoints, one module per resource
  app/models/        SQLAlchemy models
  app/schemas/       Pydantic request and response models
  app/services/      business logic: rbac, timesheets, time_import
  alembic/versions/  migrations
  scripts/           seeds
  tests/             pytest
docs/                this documentation
```

## Signing in

```mermaid
sequenceDiagram
    autonumber
    participant U as User
    participant B as Browser
    participant N as Next.js
    participant F as FastAPI
    participant D as PostgreSQL

    U->>B: submits email + password
    B->>N: POST /api/auth/login
    Note over N: the tenant comes from the<br/>host, never from the form
    N->>F: POST /api/v1/auth/login
    F->>D: find user in this organisation
    D-->>F: user row
    F->>F: verify argon2id hash
    Note over F: a correct password stored with<br/>outdated parameters is rehashed
    F-->>N: JWT (12h) + user + organisation
    N-->>B: Set-Cookie httpOnly, sameSite=lax
    B->>U: redirected to /projects
```

The JWT carries `sub` (user id), `org` (organisation id), `slug` and an
expiry — 12 hours by default (`access_token_expire_minutes`). It is signed
HS256 and validated on every request.

## A request that needs a permission

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant N as Next.js
    participant F as FastAPI
    participant D as PostgreSQL

    B->>N: GET /api/projects/{uuid}/timesheets
    N->>F: forwards with bearer token
    F->>F: decode JWT → user id, organisation id
    F->>D: load user
    F->>D: SELECT project WHERE public_id AND organization_id
    alt no such project in this tenant
        F-->>N: 404 Project not found
        Note over F: 404 not 403 — a 403 would<br/>confirm the row exists
    else found
        F->>D: effective_permissions(user, project)
        alt permission missing
            F-->>N: 403
        else granted
            F->>D: load timesheets
            F-->>N: 200, public ids only
        end
    end
    N-->>B: response
```

`require_project_permission` is the single place a project's public id is
exchanged for its row — one lookup on a unique index, no join. Everything after
it works from the `BIGINT` key.

## Bulk time upload

The one flow with real branching. Nothing is written until the whole file has
been read and shown back.

```mermaid
flowchart TD
    A[User drops a CSV] --> B[POST …/time/import?dry_run=true]
    B --> C{Parses?}
    C -->|no| D[422 with row and column<br/>for every problem]
    D --> A
    C -->|yes| E[Preview: rows, total,<br/>duplicates flagged]
    E --> F{User confirms?}
    F -->|no| A
    F -->|yes| G[POST …/time/import]
    G --> H[Rows written in one transaction]
    H --> I[Result: imported, skipped]

    style D fill:#fce8e6,stroke:#ea4335,color:#111
    style I fill:#e6f4ea,stroke:#34a853,color:#111
```

Rules the parser enforces, in `app/services/time_import.py`:

- **At most 31 rows of time**, the header not counted — one upload is one month.
- **A single bad row rejects the whole file.** A half-applied month is harder to
  reconcile than one that never landed.
- Dates read **day-first** (`05/10/2026`), ISO also accepted.
- Duration as `logged_hours` (`1:40` or `1.5`), `logged_minutes` (under 60), or
  both added together.
- Re-uploading the same file skips rows already logged, unless forced.

## Multi-tenancy

`Organization` is the root. Every other table reaches it, directly or through a
parent, and deleting one cascades.

Three things keep tenants apart:

1. **The subdomain decides the tenant**, and it is read from the host header —
   never from user input.
2. **The JWT names the organisation it was issued for**, so a token from one
   tenant is meaningless in another.
3. **Every query is scoped to the caller's organisation**, including lookups by
   public id, which are unguessable already. Isolation does not rest on an id
   being hard to guess.
