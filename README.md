# Family Savings and Expenses Tracker

A private, mobile-first website (Arabic by default, English toggle) that tracks:

- the monthly salary split (75% to Dad, 2.5% of salary is sadaqah within it, 25% kept),
- the cash savings Dad holds for the owner (with monthly cash counts),
- family expenses the owner pays and Dad reimburses at month-end,
- an optional personal spending tracker.

Specs: [docs/specs.md](docs/specs.md). Build plan: [docs/todo.md](docs/todo.md).

## Setup

```bash
npm install
cp .env.example .env.local
npm run migrate        # applies SQL migrations (embedded PGlite in dev, Postgres if DATABASE_URL is set)
npm run create-owner   # prompts for the owner email and password
npm run dev            # http://localhost:3000
```

`npm run seed:dev` creates a demo owner (`owner@example.com` / `demo-password`) with sample data.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` / `test` | Quality checks (also run in CI) |
| `npm run e2e` | Playwright end-to-end tests (builds the app, starts it on port 3100 with a throw-away database; needs Google Chrome installed) |
| `npm run check:bundle` | Fails if a secret ended up in the browser JavaScript (run after `npm run build`) |
| `npm run restore -- file.json` | Restore a backup into an empty database |
| `npm run migrate` | Apply `supabase/migrations/*.sql` |

## Conventions

- **Money** is stored and computed as integer halalas (1 SAR = 100). No floating point for money.
- **Rounding:** `fatherShare = round(salary * 0.75)`, `sadaqah = round(salary * 0.025)`,
  `savingsDeposit = fatherShare - sadaqah`, `ownerKeeps = salary - fatherShare`.
- **Server-side authority:** month locks, read-only father access and validation are enforced on the
  server and by database triggers, never only in the UI.
- **Activity log:** every create/edit/delete is written to an insert-only `activity_log` by database triggers.
- **Arabic first:** all text comes from `messages/*.json`; layouts use logical CSS properties for RTL.

## Architecture notes (deviations from the original plan)

- Data access uses plain SQL through one `Db` interface (`src/db`). In production it connects to the
  Supabase Postgres database with `DATABASE_URL`; in development and tests it uses an embedded
  Postgres (PGlite), so no Docker is needed.
- The owner login and the father's link + PIN are implemented in the app (signed, HTTP-only cookies,
  scrypt password hashing). Supabase Auth is not used. All tables have row-level security enabled with
  no policies, so the public Supabase API keys can never read data.

## Backup and restore

- **Download any time:** More → Export and backup (spreadsheet for reading, JSON for restoring).
- **Weekly email:** `/api/cron/backup` (Vercel cron, Sundays 03:00 UTC) emails both files to the reminder email.
  Needs `CRON_SECRET`, `RESEND_API_KEY` and a reminder email in Settings.
- **What a backup contains:** every table (months, savings ledger, expenses, cash counts, personal expenses,
  activity log). It never contains the password, the PIN or the link hash.
- **Restore into an empty database:**

```bash
# 1. point DATABASE_URL at a new, empty Postgres (or leave it empty for the embedded dev database)
npm run migrate
npm run restore -- path/to/family-tracker-2026-04-05.json
npm run create-owner          # sets the owner password again
# 2. sign in and turn Dad's access on again (More → Dad's access): a new link and PIN are created
```

Restoring keeps ids, closed months and the whole activity log exactly as they were. It refuses to run on a
database that already contains data. The restore path is covered by `tests/unit/backup.test.ts`.
