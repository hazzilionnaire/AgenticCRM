# AgenticCRM — Phase 1

A B2B CRM for managing company accounts: full CRUD, search and filtering, automatic
tiering, tier-based lead assignment, prospect workflow tracking, and a per-account
change log.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 7

---

## Getting started

```bash
npm install
cp .env.example .env          # then fill in DATABASE_URL and AUTH_SECRET
                               # (ANTHROPIC_API_KEY too, for "Draft intro email")
npm run db:migrate            # create the schema
npm run db:seed               # 8 reps, 15 industries, 4 assignment pools, 12 companies
npm run dev
```

Sign in with any seeded account and the password `password123`, e.g.
`admin@agenticcrm.test` or `chris.ent@agenticcrm.test`.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js dev server / production build / serve |
| `npm test` | Vitest — unit + integration (needs the test DB, see below) |
| `npm run typecheck` / `lint` | `tsc --noEmit` / ESLint |
| `npm run db:migrate` / `db:deploy` | Apply migrations (dev / production) |
| `npm run db:seed` / `db:reset` | Seed / drop-recreate-reseed |
| `npm run db:studio` | Prisma Studio |

Integration tests run against a **separate** database configured in `.env.test`, so a
test run can never touch development data:

```bash
createdb agenticcrm_test
DATABASE_URL="postgresql://…/agenticcrm_test" npx prisma migrate deploy
npm test
```

### Deploying to Vercel

Root Directory must be `./` (the repo root, where `package.json` lives) and the
framework preset Next.js. Set `DATABASE_URL`, `AUTH_SECRET` — at least 32
characters — and `ANTHROPIC_API_KEY` as environment variables for both
Production and Preview. Without the last one, every request except
"Draft intro email" works normally; that one button 500s.

Vercel runs `vercel-build` in preference to `build`, which adds
`prisma migrate deploy` so every deployment applies pending migrations.
`migrate deploy` holds a Postgres advisory lock for the run, and that isn't
reliable over a transaction-mode pooler (Neon's `-pooler` host, Supabase's
port 6543) — the lock can be left stuck, and every later deploy times out on
`P1002` waiting to acquire it. If `DATABASE_URL` is a pooled connection, also
set `DIRECT_URL` to the same database's direct connection string (Neon: same
host minus `-pooler`; Supabase: port 5432 instead of 6543) — `prisma.config.ts`
uses it for migrations while the app and seed script keep using the pooled
`DATABASE_URL` for everything else. Skip `DIRECT_URL` if `DATABASE_URL` is
already direct, e.g. a self-hosted Postgres.

Migrations create the schema but no rows, so seed the database once before the
first sign-in, otherwise every login is a legitimate 401:

```bash
DATABASE_URL="<production url>" npm run db:seed
```

---

## Core behaviour

### Auto-tiering

Tier is **derived, never entered by hand**. `src/server/tiering/calculate-tier.ts` is a
pure function — no I/O, no clock — and is the only place tier is decided.

| Tier | Employees | Revenue | Label |
| --- | --- | --- | --- |
| 1 | 1–49 | < $10M | Small |
| 2 | 50–249 | $10M–$50M | Mid-Market |
| 3 | 250–999 | $50M–$1B | Enterprise |
| 4 | 1,000+ | $1B+ | Strategic / Global Enterprise |

- Headcount and revenue are evaluated independently; **the higher tier wins**.
- **Exact revenue beats the revenue band** when both are present.
- Whichever signal exists is used — tier is `null` only when neither is.
- Boundaries are inclusive at the lower edge: exactly $10M is Tier 2, $50M is Tier 3,
  $1B is Tier 4.
- Recalculated inside the same transaction as any write touching `employeeBand`,
  `annualRevenueExact` or `annualRevenueBand`. `tier` is stripped from all client input.

The create/edit form previews the tier live using the same function the server runs.

### Lead auto-assignment

`AssignmentRule` maps each tier to an ordered pool of reps, editable at
**Settings → Assignment rules** — no code change or redeploy to adjust. Strategy is
per-tier: `ROUND_ROBIN` (walks the pool via a persisted cursor) or `FIXED`.

Ownership policy:

- A company with **no owner**, or one whose owner was **auto-assigned**, is assigned
  from the tier's pool. The new owner is notified.
- An owner set **by hand** is `MANUAL` and is **never replaced**. When such an account
  changes tier, the owner is notified of the move and offered a rep from the *new*
  tier's pool as **tier support**. Accepting adds that rep as a `CompanyCollaborator`;
  the owner keeps the account either way. Declining is recorded in the change log.

"Experienced in that tier" is defined as membership in that tier's assignment pool —
one list drives both auto-assignment and support suggestions.

The offer only fires on an actual tier *change*. Creating a company with a hand-picked
owner produces no offer, because nothing has changed yet.

### Search, filtering, sorting

Search matches legal name and DBA name (case-insensitive). Filters — all multi-select,
all composable, all reflected in the URL so views are shareable:

industry · employee band · revenue band · **exact revenue min/max** · tier · lifecycle
stage · workflow stage · company type · account status · owner (including "unassigned")
· include-deleted.

Size filters are independent of the tier calculation: you can filter by employee band
without tier interfering, and by tier without touching size.

Every column sorts, with a stable `id` tiebreak so pagination can't drop or repeat rows.

### Workflow tracking

`PENDING → CONTACTED`, with the timestamp and the rep who moved it stored on the company
and written to the change log. Moving backwards is allowed so a mis-click can be undone.
Stage order lives in `src/server/workflow/stages.ts`; adding `QUALIFIED` or
`MEETING_SET` means adding to the enum and that array — call sites read the order from
there.

### Change log

Every write diffs the patch against the current row and logs one entry per field that
actually moved — submitting a field unchanged logs nothing. Creation, tier
recalculation, owner assignment, workflow moves, collaborator changes, delete and
restore are all recorded, attributed to a user or to `System`.

### Soft delete

`deletedAt` is set rather than rows being destroyed. Deleted companies are excluded from
reads unless `includeDeleted=true`, cannot be edited, and can be restored.

---

## Project structure

```
prisma/
  schema.prisma            data model
  seed.ts                  demo data
src/
  app/
    (app)/                 authenticated pages — companies, notifications, settings
    api/                   route handlers (companies, workflow, activity, auth, …)
    login/
  components/              UI, grouped by feature
  lib/
    auth.ts                session cookie, password hashing
    db.ts                  Prisma client singleton
    labels.ts              enum → display label maps, formatters
    validation/company.ts  Zod schemas for writes and list queries
  server/
    companies/             service · repository reads · query builder
    tiering/               calculate-tier.ts  ← pure, unit-tested
    assignment/            select-assignee.ts (pure) · assign-owner.ts (DB)
    activity/              diff + log writer
    notifications/         support-offer accept / dismiss
    workflow/              stage order and transition rules
tests/
  unit/                    tiering, assignee selection, workflow stages
  integration/             company service against a real Postgres
```

Pages are server components that call the service layer directly; mutations go through
route handlers so the same surface is available to future integrations. Business logic
lives in `src/server/` as plain functions taking a `Db`, so any of it can be lifted into
a separate service later without a rewrite.

---

## Auth

Deliberately minimal: email + password (bcrypt) against an httpOnly, signed session
cookie (`jose`, HS256, 7-day expiry). That is enough to attribute account ownership and
change-log entries, which is all Phase 1 needs. There is no RBAC yet — `UserRole` exists
on `User` but is not enforced.

Middleware bounces requests with no session cookie; the signature is verified server-side
in `getSession()`, so a forged cookie gets past middleware but never past a page or route
handler.

Swapping in NextAuth later touches only `src/lib/auth.ts` and `src/middleware.ts` — the
app calls `getSession`, `requireUser`, `createSession` and `destroySession` and nothing
else.

---

## Built for Phase 2

Fields are in place and unused, so AI features land without a schema rewrite:

- `Company.score`, `scoreUpdatedAt` — predictive scoring
- `Company.enrichmentSource`, `enrichmentUpdatedAt`, `enrichmentData` (JSON) — auto-enrichment
- `Company.healthScore`, `npsScore` — CS platform integration
- `openDealsCount`, `openTicketsCount`, `lastActivityAt` — rollups, currently only
  `lastActivityAt` is written (by workflow moves)

`Industry` is a lookup table, not an enum, so verticals can be added without a migration.
`WorkflowStage` and `CollaboratorRole` are enums designed to grow.

Out of scope in Phase 1 and not implemented: predictive scoring, competitive analysis,
next-best actions, AI contact discovery, email campaigns.

---

## Known gaps

- **Engagement rollups are not computed.** `openDealsCount` / `openTicketsCount` stay at
  0 because there are no Deal or Ticket entities yet; the fields and the read-only UI are
  in place for when there are.
- **Search is `ILIKE '%term%'`.** Fine at this scale; a `pg_trgm` index is the next step
  if the company table grows large.
- **`websiteDomain` is not unique.** Soft delete makes a DB-level unique constraint
  awkward; duplicate detection is worth adding deliberately rather than as a side effect.
- **No RBAC.** Any signed-in user can edit any company and change assignment rules.
