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
· Auth.js v5 · Tailwind v4 · sharp · Gemini or Claude for vision, chosen by
environment variable · Housecall Pro REST API

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

`STORAGE_*`, `CRON_SECRET` and the vision keys can stay empty until you need
photo upload, the abandonment sweep, or perception. The app runs without them and
reports which integrations are unconfigured under **Settings**.

Perception needs one of `GEMINI_API_KEY` (the default provider) or
`ANTHROPIC_API_KEY`, and `PERCEPTION_PROVIDER` chooses between them without a
code change. Run `npm run perception:probe` to see which are reachable from the
machine you are on — see **Status** below.

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

| Command                    | What it does                                                      |
| -------------------------- | ----------------------------------------------------------------- |
| `npm run dev`              | Dev server                                                        |
| `npm run build`            | Generates the Prisma client, then builds                          |
| `npm run typecheck`        | `tsc --noEmit`                                                    |
| `npm run lint`             | ESLint                                                            |
| `npm run format`           | Prettier                                                          |
| `npm run verify`           | Asserts the image pipeline, crypto, routing, perception and notes |
| `npm run perception:probe` | One real call per configured vision provider; prints reachability |
| `npm run accuracy`         | Classification and dimension accuracy from logged reviewer edits  |
| `npm run hcp:smoke`        | Probes the live Housecall Pro API. Read-only unless `--write`     |
| `npm run hcp:catalogue`    | Exports the service catalogue to `catalogue-export.json`          |
| `npm run db:migrate`       | Create and apply a migration                                      |
| `npm run db:seed`          | Seed development data                                             |
| `npm run db:studio`        | Browse the database                                               |

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
- **Phase 2, perception** — built. Classification, dimension estimation with a
  ranked scale reference, photo-quality assessment and the conditional corner
  close-up, confidence routing that sends a poor photograph to a callback lead
  instead of a confident wrong answer, customer confirmation of the measurement,
  and the reviewer correction log behind `npm run accuracy`. Two exit criteria
  are operational and still open: 30 real reviewed submissions, and whether
  Gemini is reachable from production.
- **Phase 3, pricing** — built. A size ladder derived from the catalogue
  snapshot, a deterministic rules table with no model anywhere in the pricing
  path, band selection from the confirmed measurement, and a refusal to match
  what a photograph cannot settle: commercial storefront, shower glass, mirrors,
  door glass, and any opening past the top of its ladder. Those sync with the
  placeholder line and an explanation instead of the nearest wrong item. One
  exit criterion is open: it has not yet run on a real session, because
  perception has not yet produced a classification anywhere.
- **Phase 4, conversation** — adaptive questioning and multi-opening
  decomposition. Not built.

The schema and module boundaries for Phase 4 already exist; those columns
(`is_additional_opening`, `opening_index`) are simply unused.

**Gemini is blocked from this development machine.** `npm run perception:probe`
returns `400 FAILED_PRECONDITION — User location is not supported for the API
use`: a region restriction on the consumer API, not a bad key. Set
`ANTHROPIC_API_KEY` to run perception locally, and run the probe again from the
production host before deciding which provider ships.

**Nothing has run end to end in any environment yet.** Storage credentials and
a franchise location carrying an API key are both configured now, but perception
has produced no classification and no dimension estimate in any environment, so
no session has ever reached catalogue matching with something to match. Setting
`ANTHROPIC_API_KEY` and `PERCEPTION_PROVIDER=anthropic` is what unblocks that on
this machine.

Still unset: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`, and
`PUBLIC_APP_URL` — without the last one the photo links in estimate notes expire
within minutes.
