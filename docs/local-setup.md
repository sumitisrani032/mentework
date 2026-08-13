# Local setup

Two ways in. **Docker** needs nothing but Docker and gets you a signed-in
workspace in one command. **Manual** installs the toolchain on your machine,
which is what you want if you are going to be editing all day and want your
editor's language server pointed at the same environment.

## With Docker

```bash
git clone <repo> && cd Mentework
cp .env.example .env
docker compose up
```

That is the whole thing. Compose starts PostgreSQL, waits for it to be ready,
applies the migrations, seeds a demo workspace **the first time only**, and
serves the API and the web app with hot reload. No Node, no Python, no uv.

Then open **<http://acme.localhost:3000/login>** and sign in as
`ada@acme.test` / `mentework`. See [Demo accounts](demo-accounts.md) for the
rest.

| | |
| --- | --- |
| Web | <http://localhost:3000> — use `acme.localhost:3000` to sign in |
| API | <http://localhost:8000> — docs at `/docs` |
| PostgreSQL | `localhost:5433` |

Source is bind-mounted, so editing a file reloads the service that owns it.

### Everyday Docker commands

| Command | What it does |
| --- | --- |
| `docker compose up` | Start everything, following the logs |
| `docker compose up -d` | Same, in the background |
| `docker compose down` | Stop it, keeping the database |
| `docker compose down -v` | Stop it and **delete the database** |
| `docker compose logs -f api` | Follow one service |
| `docker compose exec api pytest` | Run the backend tests |
| `docker compose exec api python -m scripts.seed_demo` | Re-seed, replacing the demo tenant |
| `docker compose build` | Rebuild after changing a dependency |

Dependencies are installed **into the images**, so adding a package to
`pyproject.toml` or `package.json` needs a `docker compose build` — editing
source alone does not.

### Seeding, and what it will not do

The first start seeds because the database is empty. Every start after that
prints `N organization(s) already here — leaving the database alone` and
changes nothing. `scripts/seed_demo` deletes the demo tenant before recreating
it, which is right when you ask for it and wrong on every container start.

To deliberately start over: `docker compose down -v && docker compose up`.

## Manually

Use this if you would rather run the toolchain directly.

### Prerequisites

| Tool | Version | Why |
| --- | --- | --- |
| Node.js | 20+ | Runs the Next.js frontend |
| Python | 3.12 | Runs the FastAPI backend |
| [uv](https://github.com/astral-sh/uv) | recent | Creates the Python environment |
| Docker + Compose | recent | Runs PostgreSQL 16 |

### The whole thing, in order

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

**Docker: a dependency you added is missing.** Packages are installed into the
images, not the bind mount. `docker compose build` after changing
`pyproject.toml` or `package.json`.

**Docker: port already allocated.** Something is already on 3000, 8000 or 5433
— often a manual `npm run dev` from the other setup path. Stop it, or stop the
containers.

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
