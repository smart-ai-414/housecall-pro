# GlassBot

AI-assisted glass service estimator that drafts Housecall Pro estimates from
customer photos.

A customer opens a chat widget, sends two photos of the opening, answers a few
short questions, and confirms the measurements read from the photo. The job is
routed to the right franchise, a draft estimate is created in Housecall Pro
**unsent**, and a person prices and sends it.

> The assistant observes and asks. The Housecall Pro price book prices.
> A person approves and sends.

Three separate responsibilities. No stage collapses them, and there is no price
column anywhere in the database.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · PostgreSQL via Prisma 7
· Auth.js v5 · Tailwind v4 · sharp · Claude (Anthropic) · Housecall Pro REST API

## Getting started

### 1. Prerequisites

- Node 20+
- PostgreSQL 14+ running locally

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Fill in `.env`. At minimum you need `DATABASE_URL`, and these three
secrets — generate each with `openssl rand -base64 32`:

| Variable              | Purpose                                                                     |
| --------------------- | --------------------------------------------------------------------------- |
| `AUTH_SECRET`         | Signs the staff session cookie                                              |
| `ENCRYPTION_KEY`      | AES-256-GCM key for Housecall Pro API keys. Must decode to exactly 32 bytes |
| `RESUME_TOKEN_SECRET` | Signs customer resume links                                                 |

Set `PORT` there too if you do not want 3000. Leave `AUTH_URL` commented out in
development so the origin follows whatever port you choose.

`STORAGE_*`, `ANTHROPIC_API_KEY` and `CRON_SECRET` can stay empty until you need
photo upload, vision, or the abandonment sweep. The app runs without them and
reports which integrations are unconfigured under **Settings**.

### 3. Create the database

```bash
createdb glassbot
npm run db:migrate
npm run db:seed
```

The seed prints the admin credentials and invite codes it created. It makes one
admin, three `[TEST]`-prefixed franchise locations with real metro ZIP codes, and
three invite codes — one per role.

### 4. Run

```bash
npm run dev
```

On the port from `.env` (3000 by default):

- `/` — landing page and the estimate chat widget
- `/auth/signin` — staff sign in
- `/dashboard` — staff dashboard

## Commands

| Command              | What it does                                                    |
| -------------------- | --------------------------------------------------------------- |
| `npm run dev`        | Dev server                                                      |
| `npm run build`      | Generates the Prisma client, then builds                        |
| `npm run typecheck`  | `tsc --noEmit`                                                  |
| `npm run lint`       | ESLint                                                          |
| `npm run format`     | Prettier                                                        |
| `npm run verify`     | Asserts the image pipeline, crypto and routing behave correctly |
| `npm run db:migrate` | Create and apply a migration                                    |
| `npm run db:seed`    | Seed development data                                           |
| `npm run db:studio`  | Browse the database                                             |

## Registration is invite-only

There is no open sign-up. An invite code decides the role it grants, so
promoting someone means issuing a new code rather than editing a user row.

| Role       | Sees                                                          |
| ---------- | ------------------------------------------------------------- |
| `ADMIN`    | Everything, including franchise locations and API credentials |
| `REVIEWER` | Overview, sessions, and the estimate queue                    |
| `OPERATOR` | Overview and sessions                                         |

## Housecall Pro has no test environment

**Every write goes to the live account.** Records created outside production are
prefixed `[TEST]` and flagged in the database, and the client refuses to modify a
record that is not so marked when running outside production.

Before the first real sync, verify the endpoint paths and payload field names in
`modules/housecall-pro/` against your account's API version. The request shapes
follow Housecall Pro's documented conventions but have not been exercised
against a live account from this codebase.

## Project layout

```
app/          Routing only, thin files that authorize then delegate
core/         Cross-cutting: config, db, errors, security, utils
modules/      One folder per business capability
components/   Design-system primitives
generated/    Prisma Client output, gitignored, never edited by hand
prisma/       Schema, migrations, seed
scripts/      Operational scripts
docs/         Architecture and design rationale
```

New functionality goes in `modules/<capability>/`.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — why things are shaped the
  way they are: the security model, the idempotency rule, the image pipeline
  ordering, and the traps in this particular stack. Source files carry no
  comments, so this is where the reasoning lives.
- **[CLAUDE.md](CLAUDE.md)** — working rules for this repository.

## Status

- **Phase 1, foundation** — schema, invite-only auth, landing page, dashboard.
- **Phase 2, integration** — chat widget, direct-to-storage photo upload, image
  pipeline, Housecall Pro client, session persistence, abandonment sweep, tenant
  routing.
- **Phase 3, perception** — Claude Vision classification and dimension
  estimation. Not built.
- **Phase 4, pricing** — catalogue matching and gap analysis. Not built.
- **Phase 5, conversation** — adaptive questioning and multi-opening
  decomposition. Not built.

The schema and module boundaries for phases 3–5 already exist; those tables are
simply unpopulated.
