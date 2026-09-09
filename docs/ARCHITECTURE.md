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
`<sessionId>.<nonce>.<hmac>`.

- the 16-byte random nonce makes it unguessable
- the HMAC makes it unforgeable, and binds the nonce to the session so a token
  cannot be repointed at a neighbouring session
- signed with `RESUME_TOKEN_SECRET`, deliberately separate from `AUTH_SECRET`,
  so a leaked customer link can never mint a staff session

Verifying a signature proves we minted the token, not that it is the _current_
token for that session. Callers also compare against the stored value, which is
what makes revocation (re-minting on resume) possible.

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

### There is no test environment

All writes land in the live account, alongside real customers. Two mechanisms
keep this survivable (`modules/housecall-pro/test-guard.ts`):

- anything written outside production is prefixed `[TEST]` and flagged
  `isTestRecord` in the local database
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

Territories are JSONB rather than a ZIP table because franchises define them
inconsistently — a ZIP list here, a drawn boundary there — and routing reads the
whole definition at once.

## Conversation state

State lives in PostgreSQL JSONB (`sessions.conversation_state`), not in memory
and not in workflow tooling. The clarification loop is _ask → wait for a human →
resume_, and that wait can outlive any process. Serverless makes this
non-negotiable.

`outstanding_questions` stores question-bank **IDs**, not prose. Questions come
from a fixed bank (`modules/intake/question-bank.ts`) that the model selects
from; it does not compose them. Stored history is capped at 200 messages so a
single session cannot grow a JSONB column without bound.

## Abandonment

`modules/intake/abandonment.ts`, driven by `POST /api/cron/abandonment-sweep`
(scheduled in `vercel.json`, authenticated with `CRON_SECRET` compared in
constant time). The endpoint refuses to run when `CRON_SECRET` is unset, because
an unauthenticated sweep writes to the live Housecall Pro account.

After 45 minutes of silence a session is marked `ABANDONED`. If it has contact
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

It always ends with the reminder that safety glazing is asked or verified, never
inferred: a visible safety marking proves a pane is tempered, and its absence
proves nothing.

## Graceful degradation

Dashboard reads go through `core/db/read-guard.ts`, which turns a database
connection failure into an inline warning rather than an error page. This is for
reads only — mutations fail loudly, because a mutation that quietly degrades
looks to the caller like success.

## Phases

Phase 1 (foundation) and Phase 2 (integration) are built. Still to come:

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
