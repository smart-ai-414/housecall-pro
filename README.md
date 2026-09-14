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

| Command                 | What it does                                                     |
| ----------------------- | ---------------------------------------------------------------- |
| `npm run dev`           | Dev server                                                       |
| `npm run build`         | Generates the Prisma client, then builds                         |
| `npm run typecheck`     | `tsc --noEmit`                                                   |
| `npm run lint`          | ESLint                                                           |
| `npm run format`        | Prettier                                                         |
| `npm run verify`        | Asserts the image pipeline, crypto, routing and completion rules |
| `npm run hcp:smoke`     | Probes the live Housecall Pro API. Read-only unless `--write`    |
| `npm run hcp:catalogue` | Exports the service catalogue to `catalogue-export.json`         |
| `npm run db:migrate`    | Create and apply a migration                                     |
| `npm run db:seed`       | Seed development data                                            |
| `npm run db:studio`     | Browse the database                                              |

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

The read paths in `modules/housecall-pro/` were probed against the live CCI
Glass Inc. account on 12 September 2026 and corrected to match. Three things are
worth knowing before you read that code:

- **there is no price book endpoint.** The catalogue is recovered from
  `service_item_id` references on historical line items — that is what
  `npm run hcp:catalogue` does
- **estimates are built from `options`**, each with its own line items. There is
  no flat `line_items` array on an estimate
- **there is no attachment endpoint**, so signed photo links in the estimate
  notes are the only way photos reach a reviewer. Set `PUBLIC_APP_URL` or those
  links expire in minutes

The create path has now been exercised too: `POST /estimates` with an `options`
array returns 201 and the estimate arrives unsent.

**Nothing written through this API can be deleted through it.** `DELETE` returns
404 for both customers and estimates. Every live write is permanent until
someone removes it in the Housecall Pro UI, so reuse one `[TEST]` customer:

```bash
npm run hcp:smoke -- --write --customer-id=<existing [TEST] customer>
```

`smoke-test-created-records.json` tracks what is still outstanding.
`docs/ARCHITECTURE.md` has the detail.

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
- **[docs/EMBEDDING.md](docs/EMBEDDING.md)** — the iframe snippet for the
  customer's website, and why a script embed cannot work against the
  same-origin guard.
- **[CLAUDE.md](CLAUDE.md)** — working rules for this repository.

## Status

Phase numbering follows the implementation plan (Phase 0 through Phase 4).

- **Phase 0, verification** — done. API reachability, catalogue export, the
  estimate and line-item shapes, and the create path are all confirmed against
  the live account.
- **Phase 1, foundation** — built. Schema, invite-only auth, dashboard, chat
  widget, direct-to-storage photo upload, image pipeline, Housecall Pro client,
  session persistence, tenant routing, public intake routes, durable photo links
  in estimate notes, Turnstile, session event log, completion sync, and the
  abandonment sweep beneath it.
- **Phase 2, perception** — vision classification and dimension estimation.
  Not built.
- **Phase 3, pricing** — catalogue matching and gap analysis. Not built.
- **Phase 4, conversation** — adaptive questioning and multi-opening
  decomposition. Not built.

The schema and module boundaries for phases 2–4 already exist; those tables are
simply unpopulated.

Phase 1 has not run end to end in any environment, because three things are
unset: storage credentials, a franchise location carrying an API key, and
Turnstile keys. Until storage is configured the widget runs in its no-photo
degraded mode.
