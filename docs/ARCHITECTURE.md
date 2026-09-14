# Architecture

This document holds the reasoning that would otherwise live in code comments.
Per `CLAUDE.md`, source files carry no comments — so when you need to know _why_
something is shaped the way it is, this is the file to read.

## The governing principle

> The assistant observes and asks. The Housecall Pro price book prices.
> A person approves and sends.

Three responsibilities, three separate places in the code, and no stage may
collapse them:

| Responsibility   | Owner                        | Where it lives                           |
| ---------------- | ---------------------------- | ---------------------------------------- |
| Observe          | The model                    | `classifications`, `dimension_estimates` |
| Price            | The Housecall Pro price book | `catalogue_matches` (IDs only)           |
| Approve and send | A person                     | `estimates`, `reviewer_edits`            |

**There is no `price`, `amount` or `total` column anywhere in the schema.** That
is deliberate and load-bearing. A future migration that adds one is the signal
that a responsibility is collapsing — treat it as a design review, not a chore.

## Folder structure

```
app/                    Routing only. Thin files that authorize, then delegate.
  api/intake/*          Public, unauthenticated, cost-bearing endpoints
  api/cron/*            Scheduled jobs, bearer-token authenticated
  auth/*                Sign in / sign up
  dashboard/*           Staff UI, protected

core/                   Cross-cutting concerns, no business logic
  config/               env, branding, dashboard navigation + route permissions
  db/                   Prisma singleton, read-degradation helper
  errors/               One error vocabulary for actions and route handlers
  security/             Encryption, resume tokens, rate limiting, request guards
  utils/                Formatting, class names

modules/                One folder per business capability
  auth/                 Auth.js config, authorization helpers, forms
  intake/               Conversation state, session lifecycle, abandonment, widget
  photos/               Image validation and processing, storage, ingestion
  housecall-pro/        API client, customers, estimates, live-account guard
  tenancy/              Franchise locations and territory routing
  estimates/            Idempotent sync to Housecall Pro, review queue
  dashboard/            Shared dashboard chrome and metrics
  marketing/            Public landing page

components/ui/          Design-system primitives, no business knowledge
generated/prisma/       Prisma Client output. Gitignored. Never hand-edited.
prisma/                 Schema, migrations, seed
scripts/                Operational scripts (`npm run verify`)
docs/                   This file
```

**Where does new work go?** A new capability gets `modules/<capability>/`. Put
the data access, the schemas, the services and the components for that
capability inside it. Only add to `core/` when two unrelated modules need the
same thing.

`app/` should stay thin. A page authorizes, calls a module, and renders. If a
page file has business logic in it, that logic belongs in a module.

## Stack decisions and their traps

### Next 16 + React 19

`cookies()` and `headers()` are async. `middleware.ts` is deprecated in favour
of `proxy.ts` — this project uses `proxy.ts`.

### Auth.js v5, not NextAuth v4

NextAuth v4 reads `cookies()` synchronously, which Next 16 removed. v4 is
therefore not an option, regardless of its stability record.

The config is split in two on purpose:

- `modules/auth/auth.config.ts` — edge-safe. No Prisma, no bcrypt. Imported by
  `proxy.ts`, which runs on the edge runtime.
- `modules/auth/auth.ts` — Node runtime. Holds the Credentials provider, which
  needs both.

Auth.js types the JWT and the adapter user with `unknown`-valued index
signatures, so reading a field off them widens to `unknown`. `modules/auth/roles.ts`
narrows with a real type guard rather than casting, and an unrecognised role
degrades to `OPERATOR` — least privilege — instead of being asserted into
existence.

Role lives in the JWT rather than being re-queried per request, because a
database round trip in the proxy would run on every navigation. The trade-off:
a role change does not take effect until the token refreshes. Promotion is fine;
**revocation requires deleting the user.**

### Prisma 7

Three breaking changes worth knowing:

1. A driver adapter is mandatory. `new PrismaClient()` with no arguments throws,
   and `datasourceUrl` no longer exists. See `core/db/prisma.ts`.
2. Connection URLs live in `prisma.config.ts`, not in `schema.prisma`.
3. The client generates to `generated/prisma`, imported as
   `@/generated/prisma/client`. The browser-safe enum-only entrypoint is
   `@/generated/prisma/enums` — use that one in Client Components, because
   `client` pulls in the query engine.

`prisma.config.ts` resolves `directUrl` conditionally because Prisma's `env()`
throws on an unset variable, and most local setups connect directly.

### Tailwind v4

Tokens are defined in an `@theme` block in `app/globals.css`. There is no
`tailwind.config.js`. The design is light-only on purpose: a half-finished dark
mode that leaves one panel white is worse than a considered light theme.

## Environment and the dev port

There is **one** env file: `.env`. Not `.env.local`.

Next.js loads both automatically and prefers `.env.local`, so if a stray
`.env.local` ever reappears it will silently override `.env` and the values you
edited will look ignored. The dev server prints which file it loaded
(`- Environments: .env`) — check that line first when a variable seems not to
apply.

The Prisma CLI, the seed script and `npm run verify` do not read env files on
their own, so each loads `.env` explicitly through dotenv.

That is not sufficient for a script that imports `core/db/prisma`. ES module
imports are hoisted, so every imported module is evaluated _before_ the
`loadEnv()` call in the script body — and `core/db/prisma.ts` reads
`DATABASE_URL` at module evaluation time, not lazily. The client is therefore
built with an undefined connection string and fails with a SASL password
error. `core/security/encryption.ts` and friends escape this only because they
read env inside a memoized function that nothing calls at import time.

A standalone script that needs the database should build its own
`PrismaClient` the way `prisma/seed.ts` and `scripts/setup-location.ts` do,
rather than importing the app singleton.

### Why PORT needs a launcher

Next resolves its listen port **before** it loads any env file, so `PORT` in
`.env` is ignored by a bare `next dev`. `scripts/next-with-env.mjs` loads
`.env` first, then execs Next with `--port`. That is what `npm run dev` and
`npm run start` call. An explicit `-p` on the command line still wins.

### Why AUTH_URL is commented out in development

Auth.js builds redirect URLs from `AUTH_URL` when it is set. With it pinned to
port 3000, changing `PORT` to 3100 sent every sign-in redirect to port 3000 —
a port with nothing listening on it. Left unset, and with `trustHost` enabled,
Auth.js infers the origin from the request instead, so changing `PORT` just
works. Production must set `AUTH_URL`, so that callback URLs are not inferred
from a forwarded header an attacker controls.

Note that dotenv cannot unset a variable already present in the process
environment. After removing or changing `AUTH_URL` or `PORT`, restart the dev
server rather than relying on hot reload.

## Security model

### Authorization is enforced in pages and actions, not in the proxy

`proxy.ts` gives a fast, friendly redirect. It is **not** the security boundary:
it does not run for Server Action POSTs, and any route it fails to match is
simply unprotected. Every page calls `requireUser` / `requireRole` and every
mutation calls `requireUserForAction` / `requireRoleForAction`
(`modules/auth/authz.ts`).

`core/config/navigation.ts` is the single source of truth for which roles may
see which dashboard sections. The sidebar and the proxy read the same list —
keeping them separate is how a page ends up visible in the nav but blocked on
click, or hidden from the nav but reachable by typing the URL.

`requireRole` redirects rather than calling Next's `forbidden()`, because
`forbidden()` requires the experimental `authInterrupts` flag and this is meant
to be a stable foundation.

### The public intake endpoint is a cost-attack surface

`POST /api/intake/sessions` eventually triggers paid Claude API calls. Three
guards, all before any spend:

1. **Same-origin check** (`core/security/request-guard.ts`) on every mutating
   request.
2. **Bot signals** — a honeypot field and a minimum fill time. Both fail open
   for legitimate users.
3. **Per-IP rate limiting** (`core/security/rate-limit.ts`) — a daily cap plus a
   minimum spacing between session starts, backed by the `rate_limit_log` table.
   `count_window_started_at` exists because without it "today" is ambiguous and
   the counter either never resets or resets on someone else's timezone
   boundary.

### Secrets at rest

Housecall Pro API keys are encrypted per franchise location with AES-256-**GCM**
(`core/security/encryption.ts`). GCM rather than CBC because application code
writes these ciphertexts to a database: without an authentication tag, an
attacker with write access to the row could tamper with the ciphertext and we
would decrypt the result and use it. The tag turns that into a decryption
failure.

Ciphertexts are versioned (`v1.<iv>.<tag>.<body>`) so a key rotation or
algorithm change can roll out without guessing how an existing row was encrypted.
`ENCRYPTION_KEY` is validated by _decoded_ length: base64 of 32 bytes is 44
characters, and a 32-character string is a believable-looking key that would
silently weaken AES-256.

A saved key is never returned to a browser, not even to the admin who entered it.
Replace it rather than reading it back.

### Customer resume links

A resume link is the only credential in the customer flow, and it addresses a
record holding a residential address and photos of the house. Format:
`<sessionId>.<nonce>.<issuedAt>.<hmac>`.

- the 16-byte random nonce makes it unguessable
- the HMAC makes it unforgeable, and binds the nonce to the session so a token
  cannot be repointed at a neighbouring session
- signed with `RESUME_TOKEN_SECRET`, deliberately separate from `AUTH_SECRET`,
  so a leaked customer link can never mint a staff session

- `issuedAt` is inside the signed payload, so the seven-day expiry cannot be
  stretched by editing the token. `RESUME_TOKEN_TTL_DAYS` lives in
  `core/security/resume-token-policy.ts` rather than in `resume-token.ts`
  itself, because the widget displays the figure to the customer and importing
  the signing module into a Client Component would pull `node:crypto` into the
  browser bundle.

Verifying a signature proves we minted the token, not that it is the _current_
token for that session. Callers also compare against the stored value, which is
what makes revocation (re-minting on resume) possible. Expiry and revocation
are both needed: the signature bounds how long a leaked link works, and the
stored-value comparison is what lets us cut one off early.

A JWT was the obvious alternative and was rejected. Revoking one needs a
denylist, which is a second source of truth for something a single stored
column already answers.

### Photo links inside estimate notes

When photo attachment is unavailable, the notes carry links instead — and a
reviewer may open that estimate a week after it was created. A raw signed
storage URL cannot survive that: ours are minted for 15 minutes, and SigV4
caps any presigned URL at seven days regardless.

So notes carry `/api/photos/<token>` on our own origin
(`modules/photos/photo-link.ts`). The route verifies an HMAC token and
redirects to a freshly signed URL, so the link in the note stays valid for 90
days while the storage URL behind it stays short-lived.

The photo token reuses `RESUME_TOKEN_SECRET` but signs a payload prefixed
`photo-access`. That domain separator is what stops a resume token being
replayed as a photo token, or the reverse — both are 4-part HMAC tokens over
the same secret, and `npm run verify` asserts that each rejects the other.

Building an absolute URL needs an origin the request cannot supply: the
abandonment sweep runs from cron with no meaningful request, and deriving an
origin from a `Host` header would write an attacker-controllable URL into a
record staff will click. `PUBLIC_APP_URL` (falling back to `AUTH_URL`) is
therefore explicit. When neither is set the notes fall back to short-lived
signed URLs and say so in `REVIEWER MUST CHECK`, rather than silently
producing links that are dead on arrival.

## Failure modes that must not take the app down

### An unreadable session cookie

Auth.js throws `JWTSessionError` when a session cookie exists but cannot be
decrypted. Two ordinary situations cause it:

- `AUTH_SECRET` changed, which invalidates every issued cookie.
- Another application set a cookie of the same name on the same host. Browsers
  ignore the port, so every `localhost` project shares one cookie jar — any
  other Auth.js app you have run locally is enough.

Letting that throw is worse than it sounds: `auth()` is called by the sign-in
page itself, so a bad cookie locks you out of the one page that could fix it.

So an unreadable cookie is treated as _signed out_, never as an error:

- `modules/auth/authz.ts` catches it and returns no user.
- `proxy.ts` catches it, redirects to sign-in, and **deletes** the cookie, so the
  next request is clean and the problem does not repeat.
- `modules/auth/auth.config.ts` downgrades the log to one explanatory warning
  instead of a red stack trace.

Both catches check `error instanceof AuthError` and re-throw anything else. That
matters: Next signals static-render bailouts by throwing `DynamicServerError`,
and swallowing it silently breaks static/dynamic detection at build time. A
catch-all here was a real bug, caught by the build printing auth warnings while
prerendering pages.

### An integration that is not configured

Storage, Claude and Housecall Pro credentials are genuinely absent in early
phases. A missing one must produce a clear answer, not a 500.

Photo upload is the worked example. `isPhotoUploadAvailable()` gates it, and the
result travels to the browser as `photoUploadAvailable` on the session view, so:

- the API answers `503 FEATURE_UNAVAILABLE` with a message a customer can act on,
  rather than throwing an `EnvironmentError` out of a route handler;
- the widget stops offering an upload button that cannot work;
- the opening message drops the request for photos;
- intake still completes — contact details are captured and the lead is routed.

The rule: a feature that is switched off should shrink the flow, not break it.

## Photo handling

`modules/photos/image-processing.ts`. The order of operations matters:

1. **Validate by magic bytes, never by extension or declared content type.** A
   PHP file named `.jpg` is rejected on its first four bytes.
2. **Read dimensions from the header before any decode.** A 50000×50000 PNG is
   rejected from 24 bytes of header, before a decoder ever allocates. For HEIC
   and AVIF this scans every `ispe` box and takes the largest, because taking
   the first would pick up a thumbnail and under-report the real size — and
   under-reporting is the dangerous direction for a bomb guard.
3. **Convert HEIC to JPEG.** It is the iOS default, and sharp's prebuilt
   binaries do not decode it, hence `heic-convert`.
4. **Apply EXIF orientation, then strip metadata.** In that order. Stripping
   first feeds the model a sideways image, which quietly wrecks dimension
   estimation. `sharp().rotate()` with no argument auto-orients from EXIF, and
   sharp drops metadata on re-encode unless told otherwise.
5. **Re-encode unconditionally.** This is also what removes the GPS coordinates
   a phone attaches to a photo of someone's house.
6. Cap the long edge at 2048px. Vision models do not need 48 megapixels, and
   tokens cost money.

`session_photos` records which of these steps ran per photo, because "was this
image upright and stripped when the model saw it?" is a question you will need
to answer later.

Photos upload **direct to storage** with a short-lived signed PUT URL, so image
bytes never transit the application server. The server signs the key, the
browser uploads, then `POST /api/intake/photo-confirm` fetches the object,
processes it, writes the processed version, and deletes the original.

`npm run verify` proves points 1, 2 and 4 against real generated images.

## Housecall Pro integration

### What the live API actually exposes

Probed against the CCI Glass Inc. key on 12 September 2026. Three findings
contradicted the assumptions the client code was first written against, and all
three are load-bearing.

**There is no price book endpoint.** Every candidate path — `price_book`,
`price_book/services`, `price_book/service_items`, `service_items`, `services`,
`catalog`, `materials`, `products`, and versioned variants — returns 404. Not
403, so this is not obviously a plan-tier block; the resource is simply not part
of this API.

The catalogue is recovered instead from `service_item_id` references on
historical line items, which is what `npm run hcp:catalogue`
(`scripts/export-catalogue.ts`) does: it walks recent estimates and jobs,
collects distinct `service_item_id` and name pairs, and writes
`catalogue-export.json`. Identifiers and names only — no price fields are
recorded anywhere, in keeping with the governing principle.

This has a consequence for Phase 3: catalogue matching must run against an
exported snapshot, and that snapshot goes stale silently when the price book
changes. Re-running the export is the only refresh mechanism available.

### What the exported catalogue says about pricing

The first full export (500 estimates, 500 jobs, 1,556 requests) recovered **120
distinct service items in active use**, not the 33 the plan anticipated. That
number came from one category in the UI; the account bills from a much wider
set. Four things follow, and all of them touch Phase 3.

**Bands do not form one ladder.** They form several, and a residential photo
must never be matched against a storefront band:

| Family                | Bands (sq ft)                 | Tightest per-axis tolerance |
| --------------------- | ----------------------------- | --------------------------- |
| Residential           | 7, 10, 12, 18, 25             | 9.5%                        |
| Sliding door          | 16, 18                        | 6.1%                        |
| Commercial storefront | 8, 12, 16, 20, 24, 34, 35, 36 | 1.4%                        |

9.5% on the residential ladder is a reasonable target for dimension estimation
from a photograph. 1.4% on the storefront ladder is not, and no general vision
model should be expected to hit it. Commercial storefront work should route to a
human for measurement rather than be band-matched — the plan's 80% case is
residential, and that is the case the bands support.

**Naming is inconsistent and unstable**, so matching cannot be a string test.
`10 SqFt Residential Glass replacement`, `24SF IGU Storefront Glass` and
`Glass replacement  - 35 SF IGU Storefront Glass` are one idea spelled three
ways, doubled spaces and all. Worse, **55 of the 120 items appear under more
than one name**, because a line item's name is editable after it is inserted
from the price book. One id was seen 234 times under 16 names, including ones
claiming 3, 8, 18 and 25 sq ft, plus `mirrors` and
`Custom Window Supply and Install` — while 224 of those 234 said 7 sq ft.

The export therefore treats a name as evidence, never as truth. It keeps every
name observed per id with a count, picks the band supported by the most
observations, and requires that band to carry at least 20% of the id's sightings
so a single mistyped line cannot rename a catalogue item. Materials (`pbmat_`)
are excluded from banding altogether: one of them had picked up a spurious
10 sq ft band from a lone line reading `10 sq ft - IG Annealed residential`,
where a person had recorded a quantity in the name field.

Family is decided the same way — by weight across all observed names — because
the most frequent name is often the least descriptive. `18 Glass replacement`
only reveals itself as residential through a rarer sibling,
`18 SqFt Residential Glass Replacement`.

One item, `16 Glass replacement`, has a single sighting and a bare leading
number. The export lists it under `bandNeedsHumanRuling` rather than guessing.

**Multi-opening decomposition has dedicated items**, which settles the choice
the plan left open. `Glass replacement  - Additional Glass - 7sq ft.` and a
standalone `Service Call` item exist, so a two-pane job is one service call plus
per-opening items — no bundle arithmetic required.

**Shower glass is not band-priced at all.** It is named by configuration
(`Shower Glass - 90 Angles Left Shower`, `Corner Shower - Glass Panels`,
`octagon shower`, `Straight Shower w/ Sidelite`). Square footage does not select
a shower item, so the "estimate sq ft, pick the band" path does not apply to a
family the client named as one of the three common cases.

**Creating an estimate takes an `options` array**, and it was confirmed against
the live account: `POST /estimates` with
`{customer_id, note, options: [{name, line_items: [...]}]}` returns 201. The
estimate arrives with `work_status: "needs scheduling"`, `approval_status: null`
and an empty schedule — unsent, which is what this system requires. Housecall
Pro adds its own `tax` line item automatically, so a created estimate reads back
with one more line than was sent.

Two fields sent on create did **not** survive: `message_from_pro` was replaced
by the company's own template text, and `order_index` came back `null`. Neither
is load-bearing — the reviewer-facing content goes in `note` — but do not rely
on either to carry meaning.

**Estimates are built from options, not a flat line-item array.** An estimate
carries `options[]`; each option carries its own line items, reachable only at
`GET /estimates/{id}/options/{option_id}/line_items`. There is no
`/estimates/{id}/line_items`. `getEstimateLineItems` walks options to assemble
the full list.

This answers a question left open when the smoke test was written: reviewer
edits _can_ be diffed, because line items are readable after the fact. Phase 2's
accuracy loop is viable.

A line item carries `service_item_id`, `name`, `description`, `kind`,
`quantity`, `unit_of_measure`, `order_index` and `taxable`, alongside the
currency fields this system never writes. Observed `kind` values are `labor`,
`materials`, `percent discount` and `tax` — not the `service` the code
originally sent.

**Estimates and jobs use different list envelopes**, which is an easy and silent
bug: `GET /estimates/{id}/options/{id}/line_items` returns
`{page, page_size, total_pages, total_items, line_items}`, while
`GET /jobs/{id}/line_items` returns `{object, data, url}`. Reading `data` off
the estimate response yields an empty array rather than an error.

**Line item names are per-line overrides, not catalogue names.** The same
`service_item_id` appears under different names on different records — one id
was seen as both "Custom Window Supply and Install" and "7 SqFt Residential
Glass replacement". A recovered name is therefore evidence, not truth: the
export records every name observed per id, ranks them by frequency, and flags
any id whose names imply different square-footage bands. Matching must key on
`service_item_id`, never on a name.

**There is no attachment endpoint.** `POST /estimates/{id}/attachments` returns
404, as does the jobs equivalent. Signed photo links in the estimate notes are
therefore not a fallback, they are the only path, which is why
`PUBLIC_APP_URL` matters: without it the links in the notes are short-lived
S3 signatures that expire before a reviewer opens them. See
[Photo links inside estimate notes](#photo-links-inside-estimate-notes).

**Nothing created through this API can be deleted through it.**
`DELETE /customers/{id}` and `DELETE /estimates/{id}` both return 404, while
`GET`, `PUT` and `PATCH` on those same paths return 200 — a missing verb, not a
missing record. Both were confirmed against records created from here; the
estimate still answered `GET` with 200 after the delete attempt.

Two consequences, and the second is a contract question.

`npm run hcp:cleanup` cannot do what its name promises. It now reports what must
be removed by hand rather than claiming deletions it cannot perform, and
`npm run hcp:smoke` keeps a cumulative manifest
(`smoke-test-created-records.json`) of everything still outstanding, appending
across runs and persisting immediately after each create rather than at the end
— an earlier crash mid-run orphaned a live customer precisely because the
manifest was written last.

The acceptance criterion "all test records removed from the live account before
handover" **cannot be met programmatically**. Removal is a manual pass in the
Housecall Pro UI, and the plan should say so rather than implying a script can
do it.

The practical consequence for development: **every live write is permanent.**
Reuse one `[TEST]` customer across write tests —
`npm run hcp:smoke -- --write --customer-id=<id>` does this, and refuses to
proceed if the named customer does not carry the `[TEST]` prefix.

`GET /customers?q=` does filter, so deduplication by phone then email works as
designed. Customer and estimate list envelopes are
`{page, page_size, total_pages, total_items, <resource>}`; line-item collections
use `{object, data, url}` instead.

### There is no test environment

All writes land in the live account, alongside real customers. Two mechanisms
keep this survivable (`modules/housecall-pro/test-guard.ts`):

- anything written outside production is prefixed `[TEST]` and flagged
  `isTestRecord` in the local database. "Production" here means
  `HOUSECALL_PRO_LIVE_WRITES=true`, not `NODE_ENV`. A preview or staging
  deploy builds with `NODE_ENV=production`, so a `NODE_ENV` check would let it
  write unmarked records into the live account beside real customers. The flag
  is opt-in, so the failure mode of forgetting it is an over-prefixed record
  rather than a polluted CRM.
- `assertSafeToWriteFromThisEnvironment` refuses to modify a record that is not
  `[TEST]`-prefixed when running outside production

### Idempotency: record before you call

This is the rule that prevents duplicate estimates in a live account:

1. `estimates.session_id` has a **unique constraint**. That constraint _is_ the
   idempotency guarantee — a second sync attempt for the same session cannot
   insert a second reservation.
2. The local `estimates` row is written **before** the create call goes out,
   with a generated `idempotency_key`. Only after the call returns is
   `housecall_pro_estimate_id` filled in, and only then is the sync complete.
3. A retry reuses the _same_ `idempotency_key`, so Housecall Pro deduplicates it
   rather than us assuming the retry is safe.
4. A failure sets `SYNC_FAILED` and is **never** retried automatically.

`SYNC_PENDING` and `SYNC_FAILED` were added to the specified status enum because
the reservation row has to exist before the API call, and it needs a state to be
in while it does.

### Customer deduplication

Phone first, email second (`modules/housecall-pro/customers.ts`). Phone is the
stronger key in residential service: a household shares a number far more
reliably than an email address, and people mistype emails. Numbers are compared
as normalized digits with the US country code stripped, so `+1 555…`, `1555…`
and `555…` all match.

### Retries and backoff

`modules/housecall-pro/client.ts` retries only genuinely retryable failures
(429, 5xx, network, timeout) with exponential backoff plus jitter, honours
`Retry-After`, and spaces requests. **Creation calls pass `attemptLimit: 1`** —
they are never transparently retried, because an ambiguous timeout on a create
means "we do not know whether a record now exists," and the honest response is
to record the failure for a human, not to try again.

## Tenant routing

A service address is resolved to a franchise location **before** anything is
created in Housecall Pro (`modules/tenancy/territory-routing.ts`). Matching is
by ZIP code, with point-in-polygon support when coordinates are available.

Three outcomes are not "routed", and each is handled explicitly rather than
defaulted:

- `NO_ZIP_IN_ADDRESS`
- `NO_TERRITORY_MATCH`
- `AMBIGUOUS_TERRITORY` — two active locations claim the same ZIP

Ambiguity deliberately does **not** pick one. It holds the job for a human. The
locations page surfaces overlapping ZIPs so an admin can fix the cause.

There is one exception, and it only fires when there is exactly **one** active
location: an address that carries no ZIP, or a ZIP outside that location's
territory, routes to it anyway as `ROUTED_BY_SOLE_LOCATION`. With a single
franchise there is no choice to get wrong, and the alternative was worse — a
territory list that is merely incomplete stranded every lead outside it.

The outcome is named separately from `ROUTED` rather than folded into it, so
the routing note records that the territory did not actually match. Ambiguity
between two or more locations still holds for a human; this fallback never
guesses between candidates.

Territories are JSONB rather than a ZIP table because franchises define them
inconsistently — a ZIP list here, a drawn boundary there — and routing reads the
whole definition at once.

## Why contact details come first

The widget asks for name, phone and service address before it asks for
photographs. The order looks worse for conversion and is right anyway.

The abandonment sweep can only act on a session it can call back:
`modules/intake/abandonment.ts` skips anything with no contact details, and
`syncSessionToHousecallPro` refuses to create anything for a session with no
routed location. Photos-first meant that a customer who dropped out after one
upload left a row nobody could act on — which is exactly the case the tool
exists to catch.

Routing also depends on the service address, so asking for it first is what
lets every later stage name the location handling the job.

## The session event log

`session_events` is append-only, written through `recordSessionEvent`
(`modules/intake/session-events.ts`). It answers questions the session row
cannot, because a row holds only the latest state: how many sync attempts
there were and what each one failed with, when photos arrived relative to the
contact form, whether a lead was abandoned before or after routing.

`estimates.last_sync_error` keeps only the most recent failure, so without
this log "it failed twice, first on a 429 and then on a validation error" is
unanswerable.

Writes are wrapped in try/catch and degrade to a warning. Losing an audit row
must never fail the customer interaction that produced it.

`detail` deliberately holds shapes and outcomes rather than content — lengths,
counts, enum outcomes, booleans. The transcript is already in
`conversation_state` and the contact details are already on the session; a
debugging log does not need a third copy of someone's phone number.

## Conversation state

State lives in PostgreSQL JSONB (`sessions.conversation_state`), not in memory
and not in workflow tooling. The clarification loop is _ask → wait for a human →
resume_, and that wait can outlive any process. Serverless makes this
non-negotiable.

`outstanding_questions` stores question-bank **IDs**, not prose. Questions come
from a fixed bank (`modules/intake/question-bank.ts`) that the model selects
from; it does not compose them. Stored history is capped at 200 messages so a
single session cannot grow a JSONB column without bound.

## Completion

A session syncs to Housecall Pro the moment it has everything, not when the
customer says so. `modules/intake/completion.ts` holds the single definition of
"everything": a name, a phone number or email, a service address, a resolved
franchise location, every requested photo, and no unanswered question from the
bank. `assessIntakeCompleteness` is pure and is asserted by `npm run verify`;
`assessSessionCompleteness` reads the session and applies it.

Every action that can advance a session — a message, a photo, the contact form
— calls `syncIfIntakeComplete` afterwards. The customer waits on that one
request rather than on a step they have to remember to take, and the lead
reaches a reviewer while they are still at their desk.

Three guards keep that from becoming a retry loop against a live account:

- an estimate that already carries a `housecall_pro_estimate_id` reports
  `ALREADY_SYNCED` and calls nothing
- an estimate in `SYNC_FAILED` is **not** retried. A failure is a human's
  problem, per the idempotency rule above — the dashboard queue shows it
- the reservation row is written before the API call either way, so a request
  that dies mid-flight still leaves a record a reviewer can see

The abandonment sweep remains the safety net beneath all of this: a customer who
closes the tab at the wrong moment is still picked up. Because the sweep now
asks `assessSessionCompleteness` rather than assuming, a session that _was_
complete syncs as `COMPLETED_INTAKE` and is not slandered in the notes as one
the customer walked away from.

## Abandonment

`modules/intake/abandonment.ts`, driven by `POST /api/cron/abandonment-sweep`
(scheduled in `vercel.json`, authenticated with `CRON_SECRET` compared in
constant time). The endpoint refuses to run when `CRON_SECRET` is unset, because
an unauthenticated sweep writes to the live Housecall Pro account.

`NEEDS_CALLBACK` counts as an open status for the sweep. It is a state a
session reaches while the customer is still present — set the moment an
address fails to route — not a terminal one. Leaving it out meant those
sessions were never marked abandoned and never counted anywhere, which is
precisely the "every submission accounted for" guarantee failing silently.

After four hours of silence a session is marked `ABANDONED`. The window is a
judgement call, not a derived number: 45 minutes chased customers who had gone
to find a tape measure, and 24 hours meant an evening lead was not actionable
until the following evening, which defeats the out-of-hours capture the tool
exists for. Four hours keeps a same-day lead same-day. The sweep runs hourly,
so the real delay is four to five hours. If it has contact
details **and** a routed location, it syncs as a partial lead: an unsent
Housecall Pro estimate whose notes say plainly that intake was never completed
and that someone should call. A session with no contact details is only marked,
never synced — there would be nothing to act on.

`sessions(status, last_customer_message_at)` is indexed to drive this sweep.

## Structured estimate notes

Every synced estimate carries a notes header
(`modules/estimates/estimate-sync-service.ts`) that separates what the model
_observed_ from what the customer _confirmed_, and lists what the reviewer must
still check. A reviewer should never have to open this application to judge an
estimate.

It also carries **what the customer actually said**. Answers are stored against
their question id in `conversation_state.collected.answers`, not left to be
reconstructed from the transcript, so the notes can quote the customer verbatim
under the question they were answering.

## Safety glazing

Code may require safety glazing when glass sits beside a door, in a bathroom, low
to the floor, or in a stair or hallway. None of that is inferable from a
photograph: a visible etched marking proves a pane is tempered, but its absence
proves nothing, because the mark is often hidden by the frame.

So it is **asked**. `SAFETY_GLAZING_CONTEXT` is in the question bank and in
`OPENING_QUESTION_SEQUENCE`, which means every customer sees it rather than only
those whose photographs happen to look suspicious.

`safetyGlazingMayBeRequired` reads the answer and is deliberately asymmetric:

- no answer, or "not sure" → `null`, unknown
- an explicitly listed location → `true`
- **only** an exact "none of these" → `false`
- anything unrecognised → `true`

That last rule is the important one. A free-text answer the parser does not
understand errs toward flagging, because the cost of flagging unnecessarily is a
reviewer glancing at a line, and the cost of missing it is the wrong glass in a
door. The notes render each of the four states differently, and every one of
them still says to verify on site — the question improves what the reviewer
knows, it does not replace the survey.

## Graceful degradation

Dashboard reads go through `core/db/read-guard.ts`, which turns a database
connection failure into an inline warning rather than an error page. This is for
reads only — mutations fail loudly, because a mutation that quietly degrades
looks to the caller like success.

## Phases

Phase 1 (foundation) and Phase 2 (integration) are built, along with the
public intake routes (`/estimate`, `/estimate/resume/[token]`), durable photo
links and the session event log. Still to come:

- **Phase 3, perception** — Claude Vision fills `classifications` and
  `dimension_estimates`, with confidence routing. `is_low_confidence` is written
  at insert time so the review queue can filter on an indexed column instead of
  re-deriving a threshold on every read. `raw_model_output` is kept verbatim so a
  run can be replayed when a prompt or model version changes.
- **Phase 4, pricing** — catalogue matching against the price book. Gap analysis
  must use a deterministic rules table, not model judgement: auditable,
  testable, and it will not drift when a model updates. The unpriceable-job path
  sets `needs_reviewer_completion` and still syncs, rather than force-fitting the
  nearest wrong item.
- **Phase 5, conversation** — adaptive questioning capped at four questions,
  customer confirmation of dimensions, and multi-opening decomposition. The
  schema already supports the last one: a multi-opening job charges the service
  call and travel once (`is_base_item`) then labour and materials per opening
  (`is_additional_opening`, grouped by `opening_index`).

## Verified behaviour

`npm run verify` (`scripts/verify-pipeline.ts`) asserts, against real generated
images and real crypto:

- magic-byte format detection, including rejecting a PHP file named `.jpg`
- header dimension reads for JPEG, PNG and WebP
- decompression-bomb rejection from the header alone
- EXIF orientation applied _before_ metadata is stripped
- long-edge capping
- AES-256-GCM round-trip, ciphertext tamper detection, and secret masking
- resume tokens rejecting truncation, mutation and session repointing
- ZIP extraction and point-in-polygon territory matching
