# GlassBot — working rules for Claude Code

## Hard rules

### 1. No comments in code files

Do not write comment sentences in any code file. This applies to `.ts`, `.tsx`,
`.css`, `.prisma`, `.mjs`, `.js` and config files of those types. No inline
comments, no block comments, no JSDoc, no explanatory headers, no
`// TODO` notes.

Write code that explains itself instead: descriptive names, small functions,
extracted well-named constants and types.

Where rationale genuinely needs recording, it goes in Markdown under `docs/`,
not in the source file.

Exceptions, because in these files the prose _is_ the content, not a comment on
code:

- Markdown files (`README.md`, `docs/**`, this file)
- `.env.example` — the `#` lines document what each variable is for
- Generated files (`generated/**`) — never hand-edit these

### 2. Never git commit or push without explicit approval

Do not run `git commit`, `git push`, `git tag`, or anything that rewrites
history unless the user has asked for it in that message. Staging and
`git status` / `git diff` are fine.

When work is ready to commit, say so and wait.

## Project shape

AI-assisted glass service estimator that drafts Housecall Pro estimates from
customer photos. Next.js App Router + PostgreSQL (Prisma) + Claude.

Governing principle, enforced throughout:

> The assistant observes and asks. The Housecall Pro price book prices.
> A person approves and sends.

Three separate responsibilities. No stage may collapse them. In particular there
is no price, amount or total column anywhere in the schema — prices live only in
the Housecall Pro price book.

## Folder structure

```
app/                  routing only, thin files that delegate
core/                 cross-cutting: config, db, errors, security, utils
modules/              one folder per business capability
components/ui/        design system primitives
generated/            Prisma client output, gitignored, never edited
prisma/               schema, migrations, seed
docs/                 architecture and design rationale
```

New functionality goes in `modules/<capability>/`. See `docs/ARCHITECTURE.md`.

## Environment

One env file: `.env`. Never create `.env.local` — Next prefers it and it will
silently shadow `.env`.

`PORT` in `.env` is honoured because `npm run dev`/`start` go through
`scripts/next-with-env.mjs`; a bare `next dev` would ignore it. Leave `AUTH_URL`
commented out in development so redirects follow `PORT`.

## Stack facts that are easy to get wrong

- **Next 16 + React 19.** `cookies()` and `headers()` are async.
- **Auth.js v5** (`next-auth@5.0.0-beta.32`), not NextAuth v4. v4 breaks on
  Next 16 because it reads `cookies()` synchronously.
- **Prisma 7.** A driver adapter is mandatory — `new PrismaClient()` with no
  arguments throws. Connection URLs live in `prisma.config.ts`, not in
  `schema.prisma`. Import the client from `@/generated/prisma/client`.
- **Tailwind v4.** Tokens are defined in `@theme` in `app/globals.css`; there is
  no `tailwind.config.js`.
- `middleware.ts` must stay edge-safe: no Prisma, no bcrypt. That is why the
  auth config is split into `auth.config.ts` (edge) and `auth.ts` (Node).

## Housecall Pro

**There is no test environment. All writes go to the live account.**

- Anything written from a non-production environment carries the `[TEST]` prefix
  and sets `isTestRecord: true`.
- Never write to or modify a record that is not marked as a test record from a
  dev environment.
- Customer deduplication: phone first, email second. Phone is the stronger key in
  residential service.
- Idempotency: the local `estimates` row is written _before_ the create call, and
  a create is never blind-retried.

## Commands

```
npm run dev          dev server
npm run typecheck    tsc --noEmit
npm run lint         eslint
npm run db:migrate   prisma migrate dev
npm run db:seed      seed dev data
npm run db:studio    browse data
```
