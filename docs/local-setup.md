# Local setup

From nothing to a signed-in workspace. Takes about five minutes, most of it
waiting on installs.

## Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20+ | Runs the Next.js frontend |
| Python | 3.12 | Runs the FastAPI backend |
| [uv](https://github.com/astral-sh/uv) | recent | Creates the Python environment |
| Docker + Compose | recent | Runs PostgreSQL 16 |

## The whole thing, in order

```bash
git clone <repo> && cd Mentework

npm install                 # frontend dependencies
npm run setup:api           # creates backend/.venv and installs the API

cp .env.example .env        # database URL, ports, CORS origins
npm run db:up               # PostgreSQL 16 in Docker, on port 5433
npm run db:migrate          # 8 migrations
npm run db:seed             # demo organisation, 7 people, 3 projects
npm run db:seed:storefront  # a team and a month of logged time

npm run dev                 # frontend :3000 and API :8000 together
```

Then open **<http://acme.localhost:3000/login>** and sign in as
`ada@acme.test` / `mentework`.

## Why `acme.localhost` and not `localhost`

The subdomain *is* the tenant. `getSession` reads the organisation from the
host, never from the login form, so signing in at plain `localhost:3000` has no
organisation to sign in to. Browsers resolve any `*.localhost` name to the
loopback address on their own, so no `/etc/hosts` entry is needed.

`NEXT_PUBLIC_ROOT_DOMAIN` controls the domain subdomains hang off.

## Ports

| Port | What |
| --- | --- |
| 3000 | Next.js frontend |
| 8000 | FastAPI backend |
| 5433 | PostgreSQL in Docker |

**5433 is deliberate.** It keeps the container clear of a system PostgreSQL
sitting on the default 5432. This catches people out — see Troubleshooting.

## Every command

| Command | What it does |
| --- | --- |
| `npm run dev` | Frontend and API together, both reloading |
| `npm run dev:web` | Frontend only |
| `npm run dev:api` | API only |
| `npm run build` | Production build of the frontend |
| `npm run lint` | ESLint over the frontend, Ruff over the backend |
| `npm run test` | The backend test suite |
| `npm run setup:api` | Create `backend/.venv` and install the API |
| `npm run db:up` / `db:down` | Start / stop PostgreSQL |
| `npm run db:migrate` | Apply migrations to head |
| `npm run db:revision -- "message"` | Autogenerate a migration |
| `npm run db:seed` | Demo organisation with roles, projects and people |
| `npm run db:seed:storefront` | A project team and a month of logged time |
| `npm run org:create` | Create an organisation interactively |

## Connecting to the database

The app's database is the **Docker** one on 5433, not any system PostgreSQL you
may have on 5432.

```bash
# through the container — no client or password needed
docker exec -it mentework-postgres psql -U mentework -d mentework

# or from the host
PGPASSWORD=mentework psql -h localhost -p 5433 -U mentework -d mentework
```

`-h localhost` matters. Without it `psql` prefers the Unix socket and silently
lands on a different server, even with `-p 5433`.

## Troubleshooting

**`psql` says the `mentework` database does not exist.** You are on the system
PostgreSQL on 5432. Use one of the two commands above.

**Peer authentication failed for user "mentework".** Same cause: no host was
given, so it went to the socket. Also check that `DATABASE_URL` in `.env` is on
a single line — a line break inside it drops the host and produces exactly this
error.

**Migrations or tests cannot reach the database.** `npm run db:up` first, then
confirm with `pg_isready -h localhost -p 5433`.

**A page 404s after pulling changes.** The Next dev server caches compiled
routes in `.next`. Restart it. Running `npm run build` while `next dev` is
running writes to the same directory and can confuse it.

**Seeds refuse to run.** They exit unless `ENVIRONMENT=development`. That guard
is deliberate: `db:seed` deletes the existing demo tenant before recreating it.

## Resetting to a clean database

```bash
docker exec mentework-postgres psql -U mentework -d postgres \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='mentework';" \
  -c "DROP DATABASE mentework;" -c "CREATE DATABASE mentework OWNER mentework;"

npm run db:migrate && npm run db:seed && npm run db:seed:storefront
```

Note that the test suite runs against this same database, so `npm run test`
advances the id sequences. Harmless, but it is why a fresh seed does not always
start at id 1.
