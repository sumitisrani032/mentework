# Demo accounts

Twelve accounts across one organisation, created by the two seed scripts. Every
one of them uses the same password.

> **Password for all accounts: `mentework`**
>
> Development only. The seed scripts refuse to run unless `ENVIRONMENT` is
> `development`, and they hash with argon2id like any real account.

**Sign in at <http://acme.localhost:3000/login>** — the subdomain chooses the
tenant, so plain `localhost:3000` will not work.

## Organisation

| | |
| --- | --- |
| Name | Acme Design |
| Slug | `acme` |
| Sign-in URL | `acme.localhost:3000/login` |

## From `npm run db:seed`

Seven people, one per built-in role, so every level of access can be seen.

| Email | Name | Role | Scope |
| --- | --- | --- | --- |
| `ada@acme.test` | Ada Okonkwo | Organization Admin | Whole organisation |
| `bruno@acme.test` | Bruno Salgado | Project Manager | Website Relaunch |
| `chen@acme.test` | Chen Wei | Team Lead | Website Relaunch |
| `dara@acme.test` | Dara Nwosu | Member | Website Relaunch |
| `eli@acme.test` | Eli Fischer | Member | Mobile App |
| `fern@acme.test` | Fern Whitaker | Client | Website Relaunch |
| `gita@acme.test` | Gita Bhatt | Viewer | Mobile App |

**Start with `ada@acme.test`** — organisation-wide access to everything,
including Settings → Roles and Settings → People.

## From `npm run db:seed:storefront`

Five more people on the Storefront Revamp project, with a month of logged time
between them.

| Email | Name | Role |
| --- | --- | --- |
| `hana@acme.test` | Hana Yusuf | Project Manager |
| `ivan@acme.test` | Ivan Petrov | Team Lead |
| `jia@acme.test` | Jia Chen | Member |
| `karim@acme.test` | Karim Haddad | Member |
| `lena@acme.test` | Lena Novak | Member |

All five are assignees of the **Storefront Timesheet**, which is private —
being on the project is not enough to see it.

**Sign in as `hana@acme.test`** to land on a timesheet with real data: 87
entries across 01–31 July 2026.

## Projects

| Key | Name | Status | Has time logged |
| --- | --- | --- | --- |
| `WEB` | Website Relaunch | active | No |
| `MOB` | Mobile App | planning | No |
| `STO` | Storefront Revamp | active | Yes — 87 entries |

## What to sign in as, for what

| To see | Sign in as |
| --- | --- |
| Everything, including role and people settings | `ada@acme.test` |
| A populated timesheet, and the bulk CSV upload | `hana@acme.test` |
| What a plain member can and cannot do | `jia@acme.test` |
| Read-only access | `gita@acme.test` |
| How little a client sees | `fern@acme.test` |

Comparing `ada` against `gita` on the same page is the quickest way to see the
permission system working — the navigation itself changes, because every item
is gated on a permission.
