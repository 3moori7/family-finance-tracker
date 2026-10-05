# Build Plan: Family Savings and Expenses Tracker

Source: [specs.md](specs.md). Read the PRD first; this plan assumes its rules (75% split, 2.5% sadaqah within it, reimbursement claim, cash count, locked months, father view-only).

## How to use this plan

- Every task and subtask is a checklist item. Tick a task only when **all its subtasks** are done and its **Done when** line is true.
- Task ids are numbers (`1`, `2`, ...). Subtasks are `N.1`, `N.2`, etc. Each task lists `Depends on`. Do not start a task until its dependencies are ticked.
- Tasks are ordered so each one builds on earlier ones. There are no orphan tasks: every task except task 1 has dependencies, and every task except task 32 is needed by a later task (see the dependency table at the end).
- Each task is sized for one focused work session (about half a day to one day).

## Conventions (apply to every task)

- **Stack:** Next.js (App Router, TypeScript), Tailwind CSS, next-intl, Supabase (Postgres, Auth, RLS), Vercel, Resend, Vitest for unit tests, Playwright for end-to-end tests.
- **Money:** store and compute amounts as **integers in halalas** (1 SAR = 100). Never use floating point for money. Format to SAR only in the UI.
- **Rounding rule** (decide once, in task 4): `fatherShare = round(salary × 0.75)`, `sadaqah = round(salary × 0.025)`, `savingsDeposit = fatherShare − sadaqah`, `ownerKeeps = salary − fatherShare`. This guarantees the parts always sum to the salary.
- **Server-side authority:** every rule (month locks, read-only father, validation) is enforced on the server or by database policies, never only in the UI.
- **Every write goes through the activity log** (task 8).
- **Arabic first:** all user-facing text comes from translation files; layouts use logical CSS properties (`ms-`, `me-`, `ps-`, `pe-`) so RTL works.
- **Commits:** small, one task or subtask per commit, with passing tests.

---

## Phase A: Foundation

- [x] **1. Project scaffold and tooling**
  - Depends on: none
  - Context: create the base project so every later task has a consistent place to work.
  - [x] 1.1 Create a Next.js (App Router, TypeScript) project and a git repo with a `.gitignore`.
  - [x] 1.2 Add Tailwind CSS, ESLint and Prettier with a shared config.
  - [x] 1.3 Add Vitest (unit) and Playwright (e2e), plus an `npm test` script that runs unit tests.
  - [x] 1.4 Add a CI workflow that runs lint, type-check and unit tests on every push.
  - [x] 1.5 Add a short README with setup commands and the conventions above.
  - Done when: a fresh clone installs, runs `npm run dev`, and CI is green on an empty page.

- [x] **2. Supabase project and environment setup**
  - Depends on: 1
  - Context: the database and auth provider. Free tier is enough.
  - [x] 2.1 Choose the database provider: Supabase Postgres in production (`DATABASE_URL`), embedded PGlite in development and tests (no Docker needed). _Deviation: the Supabase CLI and a hosted project are replaced by a `Db` interface with `pg` and PGlite adapters._
  - [x] 2.2 Set up local development (embedded PGlite in `.data/`) and a `supabase/migrations` folder with a migration runner.
  - [x] 2.3 Add environment variables (`.env.local`, `.env.example`) for `DATABASE_URL`, `SESSION_SECRET`, email and cron secrets. Never commit real keys.
  - [x] 2.4 Create a server-side `getDb()` helper (no browser-side database client exists, by design).
  - Done when: a test page can read from the local database through the server client.

- [x] **3. Internationalization and RTL shell**
  - Depends on: 1
  - Context: Arabic is the default language, right-to-left, with an English toggle.
  - [x] 3.1 Install next-intl and create `ar.json` and `en.json` message files.
  - [x] 3.2 Make `ar` the default locale. Set `dir="rtl"` and `lang="ar"` for Arabic, `ltr` and `en` for English.
  - [x] 3.3 Add an Arabic-friendly font (for example IBM Plex Sans Arabic or Noto Sans Arabic) and a readable Latin font.
  - [x] 3.4 Add a language toggle that persists the choice (cookie).
  - [x] 3.5 Add a currency and number formatter (SAR, Western digits 0-9 by default for clarity).
  - Done when: a sample page renders in Arabic RTL by default and switches to English LTR.

- [x] **4. Finance domain library (pure functions, fully tested)**
  - Depends on: 1
  - Context: the single source of truth for all calculations. No database or UI code here.
  - [x] 4.1 Create `lib/money.ts` with helpers to convert SAR to halalas and back, and to add, subtract and format safely.
  - [x] 4.2 Create `lib/split.ts`: `calculateSplit(salary)` returns `fatherShare`, `sadaqah`, `savingsDeposit`, `ownerKeeps` using the rounding rule.
  - [x] 4.3 Create `lib/balances.ts`: `savingsBalance(entries)` (signed sum of opening, deposit, withdrawal, correction), `familyClaim(expenses)`, `personalLeft(salary, personalExpenses)` (25% minus spending, never presented as exact).
  - [x] 4.4 Create `lib/cashcount.ts`: `compareCount(counted, expected)` returns the difference and a `matches` flag.
  - [x] 4.5 Write unit tests, including the PRD example (10,000 SAR gives 7,500 / 250 / 7,250 / 2,500) and odd amounts that exercise rounding.
  - Done when: all tests pass and the parts of any split always sum to the salary.

- [x] **5. Database schema and security policies**
  - Depends on: 2
  - Context: create the tables from the PRD data model with row-level security (RLS).
  - [x] 5.1 Write migrations for `settings`, `months`, `ledger_entries`, `family_expenses`, `cash_counts`, `personal_expenses` and `activity_log`. Amounts are `bigint` halalas.
  - [x] 5.2 Add constraints: `months.year_month` unique, positive amounts where required, `ledger_entries.type` limited to `opening`, `deposit`, `withdrawal`, `correction`, a required `reason` on withdrawals and corrections.
  - [x] 5.3 Add `family_expenses.category` as a constrained value or a `categories` table (decided in task 14; leave a nullable foreign key or text now).
  - [x] 5.4 Enable RLS on all tables. Default deny, and allow the authenticated owner full access. The father role gets no direct table access (he reads through server routes in task 22).
  - [x] 5.5 Add a database check or trigger that rejects inserts, updates and deletes on rows belonging to a **closed** month (except correction entries).
  - [x] 5.6 Write seed data for local development.
  - Done when: migrations apply cleanly on a fresh local database and a test confirms an anonymous user cannot read any table.

- [x] **6. Owner authentication**
  - Depends on: 2, 3, 5
  - Context: a single owner account with an edit login.
  - [x] 6.1 Implement owner email and password login in the app (scrypt hashes, signed HTTP-only session cookie). No public sign-up; the owner is created with `npm run create-owner`. _Deviation: Supabase Auth is not used._
  - [x] 6.2 Build the login page (Arabic and English) with error messages and a loading state.
  - [x] 6.3 Add middleware that protects all owner routes and redirects unauthenticated users to login.
  - [x] 6.4 Add logout and session refresh handling.
  - Done when: an unauthenticated visit to an owner route redirects to login, and a correct login reaches a protected placeholder page.

- [x] **7. App shell and base UI components**
  - Depends on: 3, 6
  - Context: the mobile-first layout and reusable pieces every screen will use.
  - [x] 7.1 Build a mobile layout with a bottom navigation (Home, Expenses, Savings, Month, More) that works in RTL.
  - [x] 7.2 Build base components: `Button`, `Card`, `Input`, `AmountInput` (numeric keypad, halalas inside), `Select`, `Toast`, `EmptyState`, `Amount` (formatted SAR).
  - [x] 7.3 Build a `MonthSwitcher` component that shows the current month and can step to previous ones.
  - [x] 7.4 Add a basic design token set (colors, spacing, radius) and make touch targets at least 44px.
  - Done when: a sample screen using all components looks correct on a 375px phone in both languages.

- [x] **8. Activity log infrastructure**
  - Depends on: 5, 6
  - Context: every create, edit and delete must be recorded so nothing changes silently. Build this early so no history is missed.
  - [x] 8.1 Add database triggers on `ledger_entries`, `family_expenses`, `cash_counts`, `personal_expenses`, `months` and `settings` that write to `activity_log` (entity, entity_id, action, old_value, new_value, created_at).
  - [x] 8.2 Make `activity_log` insert-only: no update or delete is permitted, even for the owner.
  - [x] 8.3 Write database tests: each action creates a log row with correct old and new values.
  - Done when: creating, editing and deleting a test row each produce exactly one log row that cannot be altered.

- [x] **9. Settings and first-run setup wizard**
  - Depends on: 4, 5, 7, 8
  - Context: first-time setup per the PRD: salary, opening balance, language and reminder email.
  - [x] 9.1 Build a Settings page to edit salary amount, split percent (default 75), sadaqah percent (default 2.5), language and reminder email.
  - [x] 9.2 Build a first-run wizard: salary, opening savings balance, reminder email. Saving creates the `settings` row and an `opening` ledger entry.
  - [x] 9.3 Redirect the owner to the wizard if no settings exist.
  - [x] 9.4 Validate inputs (positive amounts, percent between 0 and 100) with clear Arabic and English messages.
  - Done when: a new owner completes the wizard and the opening balance appears as a ledger entry.

## Phase B: Salary, savings and sadaqah

- [x] **10. Month lifecycle**
  - Depends on: 5, 8, 9
  - Context: everything hangs off a "month". This task creates and resolves it.
  - [x] 10.1 Add a server function `getOrCreateMonth(yearMonth)` that creates an open month row if missing.
  - [x] 10.2 Define "current month" (the oldest open month, or the calendar month if none) and show it in the `MonthSwitcher`.
  - [x] 10.3 Prevent creating a new month while a previous one is open and older than one month (warn, do not block).
  - [x] 10.4 Add tests for month creation, uniqueness and current-month resolution.
  - Done when: opening the app always resolves a valid current month.

- [x] **11. Salary entry and split screen**
  - Depends on: 4, 10
  - Context: the first month-end step. Salary is pre-filled; the owner can adjust.
  - [x] 11.1 Build the Salary screen showing pre-filled salary from settings, an adjustment field (add or subtract) and a note field.
  - [x] 11.2 Save `salary_adjustment` and `adjustment_note` on the month, then compute the adjusted salary.
  - [x] 11.3 Show the split using `calculateSplit` on the adjusted salary: to father, sadaqah, savings deposit, owner keeps.
  - [x] 11.4 Require a note when an adjustment is not zero.
  - [x] 11.5 Add a component test for the example in the PRD and one with an adjustment.
  - Done when: entering 10,000 with no adjustment shows 7,500 / 250 / 7,250 / 2,500.

- [x] **12. Savings ledger: deposits, withdrawals and balance**
  - Depends on: 4, 8, 10
  - Context: the savings pot is the sum of ledger entries.
  - [x] 12.1 Add an action "Confirm deposit" on the Salary screen that creates a `deposit` ledger entry for the month's savings deposit (only once per month).
  - [x] 12.2 Build the Savings screen listing entries (type, amount, reason, date) with the running balance on top.
  - [x] 12.3 Add a "Withdraw" form requiring amount and reason; block withdrawals larger than the balance (show an error).
  - [x] 12.4 Add tests: deposit idempotency, balance after deposit and withdrawal, and rejection of a withdrawal above the balance.
  - Done when: the balance equals opening plus deposits minus withdrawals in every test case.

- [x] **13. Sadaqah status**
  - Depends on: 11
  - Context: only a monthly "given" flag; no recipient or date detail.
  - [x] 13.1 Show the month's sadaqah amount (from the split) on a Sadaqah card.
  - [x] 13.2 Add a toggle "Given by Dad" that sets `months.sadaqah_given`.
  - [x] 13.3 Ensure the sadaqah amount is **not** deducted from the savings balance a second time (it is already excluded from the deposit).
  - Done when: toggling the status persists, is logged, and does not change the balance.

## Phase C: Family expenses and reimbursement

- [x] **14. Expense categories**
  - Depends on: 5, 9
  - Context: a small fixed list; no custom categories in v1.
  - [x] 14.1 Define categories: Home, Car and fuel, Groceries, Other, with Arabic and English labels.
  - [x] 14.2 Store them as a constrained enum or a seeded `categories` table, and use that in `family_expenses` and `personal_expenses`.
  - [x] 14.3 Add a `CategoryPicker` component (large tap targets, one tap to choose).
  - Done when: the picker shows localized categories and only valid categories can be saved.

- [x] **15. Quick expense entry**
  - Depends on: 7, 10, 14
  - Context: the most frequent action; must take seconds on a phone.
  - [x] 15.1 Build a quick-add sheet reachable from a floating button: amount (numeric keypad), category, date (default today), optional note.
  - [x] 15.2 Save to `family_expenses` against the month that contains the date; reject dates in closed months.
  - [x] 15.3 After saving, show a toast with an Undo option and keep the sheet ready for another entry.
  - [x] 15.4 Validate amount greater than zero and show localized errors.
  - [x] 15.5 Add an e2e test that adds an expense in under four interactions.
  - Done when: an expense can be added in a few taps and appears in the database.

- [x] **16. Expense list, edit, delete and claim total**
  - Depends on: 15
  - Context: the owner needs to correct mistakes in the open month and see what to claim.
  - [x] 16.1 Build the Expenses screen listing the month's entries (newest first) with a claim total and a per-category breakdown at the top.
  - [x] 16.2 Add edit and delete for entries in an **open** month; hide these controls and reject on the server for closed months.
  - [x] 16.3 Use `familyClaim` from the domain library for the total.
  - [x] 16.4 Add tests for totals after add, edit and delete.
  - Done when: the total always equals the sum of listed entries and edits are logged.

- [x] **17. Reimbursement marker**
  - Depends on: 16
  - Context: the father pays the full amount once; the month is then marked reimbursed.
  - [x] 17.1 Add a "Mark reimbursed" action showing the exact amount, with a confirmation step.
  - [x] 17.2 Set `months.reimbursed` and store the reimbursed amount and timestamp.
  - [x] 17.3 After reimbursement, show the claim as settled; further expenses added to that month are blocked with a clear message.
  - [x] 17.4 Add tests for the state change and the block on new expenses.
  - Done when: a reimbursed month shows "settled" and cannot accept new family expenses.

- [x] **18. Home screen**
  - Depends on: 7, 12, 16
  - Context: the two key answers at a glance.
  - [x] 18.1 Build Home with two large cards: savings balance, and family expenses to claim this month (with status "to claim" or "reimbursed").
  - [x] 18.2 Add shortcuts to quick-add expense and to the month-end flow.
  - [x] 18.3 Make the cards accept a `readOnly` prop so the father's version (task 22) reuses them.
  - Done when: the home numbers match the ledger and the expenses total.

## Phase D: Cash count and month close

- [x] **19. Monthly cash count**
  - Depends on: 10, 12
  - Context: the trust mechanism for the cash held by the father.
  - [x] 19.1 Build the Cash Count screen: enter the counted cash; show the expected balance and the difference.
  - [x] 19.2 Save a `cash_counts` row with counted, expected and difference.
  - [x] 19.3 On mismatch, show a warning and a form to add a dated `correction` ledger entry with a required reason; do not edit earlier entries.
  - [x] 19.4 Re-run the comparison after a correction until it matches or the owner explicitly accepts the explained difference.
  - [x] 19.5 Add tests for match, shortage and surplus, including the correction.
  - Done when: a mismatch can be resolved only by a logged correction with a reason.

- [x] **20. Month close and lock**
  - Depends on: 11, 12, 13, 17, 19
  - Context: ties the month-end routine together and locks the month.
  - [x] 20.1 Build a guided checklist in order: salary and split, deposit confirmed, sadaqah given, reimbursed, cash count done.
  - [x] 20.2 Enable "Close month" only when all steps are complete; show what is missing otherwise.
  - [x] 20.3 On close, set `months.status = closed` and `closed_at`; the database rule from task 5.5 now blocks edits to that month.
  - [x] 20.4 Allow only `correction` ledger entries for closed months.
  - [x] 20.5 Add an e2e test of a full month-end routine and a test that edits to a closed month are rejected by the server.
  - Done when: a closed month is read-only for everything except correction entries.

## Phase E: Father's access

- [x] **21. Father link and PIN access**
  - Depends on: 5, 7
  - Context: view-only access without an account.
  - [x] 21.1 Generate a long random access token stored hashed; build the private link `/view/<token>`.
  - [x] 21.2 Add a PIN screen; store the PIN hashed (bcrypt or argon2) and verify on the server.
  - [x] 21.3 After a correct PIN, set a short-lived signed, HTTP-only cookie with a `father` role.
  - [x] 21.4 Add rate limiting and lockout after several wrong PINs.
  - [x] 21.5 Add a Settings action for the owner to change the PIN and rotate the link (old link stops working).
  - Done when: only the right link and PIN grant a father session, and rotating the link invalidates the old one.

- [x] **22. Father's read-only views**
  - Depends on: 16, 18, 21
  - Context: he sees the balance and family totals, never individual items or the personal tracker.
  - [x] 22.1 Build father routes that call server functions using the service role with the `father` session checked, returning only: savings balance, claim total, per-category breakdown, reimbursed status and cash-count status.
  - [x] 22.2 Reuse the Home cards with `readOnly` and add a simple monthly summary.
  - [x] 22.3 Show nothing editable: no forms, no buttons that call writing endpoints.
  - [x] 22.4 Ensure no endpoint serving the father returns individual expense rows or personal tracker data.
  - Done when: the father can see the numbers, and API responses contain no itemized expenses.

## Phase F: Personal tracker

- [x] **23. Personal spending tracker (optional)**
  - Depends on: 10, 15
  - Context: fully optional, owner only, low friction. It must never block the core flow.
  - [x] 23.1 Reuse the quick-add sheet with a toggle "Personal" to save into `personal_expenses`.
  - [x] 23.2 Build a Personal screen with a category breakdown for the month.
  - [x] 23.3 Show "Estimated left this month" using `personalLeft`, clearly labelled as an estimate.
  - [x] 23.4 Confirm the month-end checklist and close do not depend on this data.
  - [x] 23.5 Ensure the screens are only reachable by the owner session.
  - Done when: an empty tracker causes no errors or warnings anywhere, and entries show estimated left and categories.

## Phase G: History, statements and export

- [x] **24. Activity log screen**
  - Depends on: 7, 8
  - Context: a readable history of all changes.
  - [x] 24.1 Build a read-only list of log entries (what changed, old and new values, time), filterable by month and type.
  - [x] 24.2 Render values in human language (for example "Expense 45.00 SAR, Car and fuel, added").
  - [x] 24.3 Let the father view the log read-only (confirmed) and enforce that on the server.
  - Done when: every action from earlier tasks appears in the log in readable form.

- [x] **25. Monthly statements**
  - Depends on: 20
  - Context: a page per month summarising everything, for past reference.
  - [x] 25.1 Build a Statements list showing every month and its status.
  - [x] 25.2 Build the statement page: salary and adjustment, split, deposit, sadaqah status, family spending by category, reimbursement, cash-count result and closing balance.
  - [x] 25.3 Add tests that statement figures equal the underlying data for a closed month.
  - Done when: any past month can be opened and its numbers reconcile with the ledger.

- [x] **26. PDF export of statements**
  - Depends on: 25
  - Context: shareable proof per month.
  - [x] 26.1 Produce the PDF through a print-optimised statement page (`@page` margins, no app chrome) so the browser renders Arabic and RTL correctly. _Deviation: no server-side PDF library; the browser's "Save as PDF" is used because Arabic shaping in server PDF libraries is unreliable._
  - [x] 26.2 Add a "Save as PDF" button on the statement page that opens the print dialog.
  - [x] 26.3 Visually check the PDF in Arabic and English.
  - Done when: a downloaded PDF shows correct numbers and readable Arabic.

- [x] **27. Spreadsheet export and backups**
  - Depends on: 5, 25
  - Context: the owner's guarantee that data is never lost.
  - [x] 27.1 Build a server export that produces a spreadsheet (CSV or XLSX) with sheets for ledger, family expenses, personal expenses, cash counts and months.
  - [x] 27.2 Add an Export page with a download button.
  - [x] 27.3 Add a scheduled backup job (weekly) that exports the data and emails it or stores it in separate storage.
  - [x] 27.4 Document how to restore from a backup and test it once on a local database.
  - Done when: an export opens correctly in a spreadsheet and a restore test succeeds.

## Phase H: Reminders

- [ ] **28. Email reminders**
  - Depends on: 10, 13, 19
  - Context: month-end nudges by email only.
  - [ ] 28.1 Set up Resend and a verified sender; store the reminder email from settings. _Code is done (`src/server/email.ts` talks to the Resend API; the reminder email is stored in Settings). Still needs YOUR Resend account and API key — see docs/DEPLOY.md step 2._
  - [x] 28.2 Create a scheduled job (Vercel cron or Supabase cron) that runs daily.
  - [x] 28.3 Send reminders: month-end cash count, enter the salary, sadaqah not yet marked given; send each at most once per month.
  - [x] 28.4 Add a Settings toggle to turn reminders off.
  - [x] 28.5 Test the job logic with fake dates and a mocked email sender.
  - Done when: simulated month-end dates trigger the correct email exactly once.

## Phase I: Hardening and release

- [x] **29. Security and read-only verification**
  - Depends on: 22, 23
  - Context: confirm the privacy promises from the PRD.
  - [x] 29.1 Write tests that a father session cannot call any write endpoint (all return 403).
  - [x] 29.2 Write tests that the father cannot read individual expenses or personal tracker data through any route or direct database query.
  - [x] 29.3 Test PIN rate limiting, link rotation and cookie expiry.
  - [x] 29.4 Confirm the owner routes reject unauthenticated requests and that RLS blocks anonymous access.
  - [x] 29.5 Review that no secrets or service-role keys reach the browser bundle.
  - Done when: all security tests pass and the checklist is reviewed.

- [x] **30. Mobile, PWA and RTL polish**
  - Depends on: 18, 22, 23, 25
  - Context: the app is used on phones every day.
  - [x] 30.1 Add a web app manifest and a service worker so the site can be added to the home screen.
  - [x] 30.2 Audit all screens at 360px and 390px widths in Arabic RTL and English LTR; fix overflow, icon direction and number alignment.
  - [x] 30.3 Check contrast, font sizes and tap targets for an older user (the father).
  - [x] 30.4 Add loading and offline-failure states to forms (a clear message, no silent loss of an expense).
  - Done when: a manual checklist passes on a real phone in both languages.

- [ ] **31. Deployment and production configuration** _(needs your own Supabase, Vercel and Resend accounts: everything is prepared, follow docs/DEPLOY.md)_
  - Depends on: 24, 26, 27, 28, 29
  - Context: ship to the free tier with backups on.
  - [ ] 31.1 Create the production Supabase project, run migrations and create the owner user.
  - [ ] 31.2 Deploy to Vercel with production environment variables and cron configured.
  - [ ] 31.3 Configure the production domain or default URL, HTTPS and secure cookie settings. _Cookies are already `Secure` in production and the site sets strict headers; the domain and HTTPS come with your Vercel project._
  - [ ] 31.4 Verify the weekly backup runs and an email is received.
  - [ ] 31.5 Run the e2e suite against production (read-only checks where possible). _Ready: `PROD_URL=https://your-site npm run smoke:prod` (tests/prod/smoke.spec.ts)._
  - Done when: the production site loads, the owner can log in and the first backup is received.

- [ ] **32. User acceptance and rollout** _(real-life steps that only you and your dad can do, after task 31)_
  - Depends on: 30, 31
  - Context: prove the PRD's success criteria with real data.
  - [ ] 32.1 Enter the real opening savings balance and today's family-expense total with the owner.
  - [ ] 32.2 Give the father his link and PIN; check he can read the numbers on his phone.
  - [ ] 32.3 Run one live month end to end, including the cash count with the father.
  - [ ] 32.4 Compare the app's savings balance with the physical cash; record the result.
  - [ ] 32.5 Collect feedback and list follow-up items (SMS import, receipt photos, partial reimbursements).
  - Done when: the cash count matches or any difference is explained, and the owner can answer "how much is saved?" and "how much does Dad owe me?" in seconds.

---

## Dependency table

| Task | Title | Depends on | Needed by |
|---|---|---|---|
| 1 | Project scaffold | none | 2, 3, 4 |
| 2 | Supabase setup | 1 | 5, 6 |
| 3 | i18n and RTL | 1 | 6, 7 |
| 4 | Finance library | 1 | 9, 11, 12 |
| 5 | Schema and RLS | 2 | 6, 8, 9, 10, 14, 21, 27 |
| 6 | Owner auth | 2, 3, 5 | 7, 8 |
| 7 | App shell and UI | 3, 6 | 9, 15, 18, 21, 24 |
| 8 | Activity log infrastructure | 5, 6 | 9, 10, 12, 24 |
| 9 | Settings and setup wizard | 4, 5, 7, 8 | 10, 14 |
| 10 | Month lifecycle | 5, 8, 9 | 11, 12, 15, 19, 23, 28 |
| 11 | Salary and split | 4, 10 | 13, 20 |
| 12 | Savings ledger | 4, 8, 10 | 18, 19, 20 |
| 13 | Sadaqah status | 11 | 20, 28 |
| 14 | Categories | 5, 9 | 15 |
| 15 | Quick expense entry | 7, 10, 14 | 16, 23 |
| 16 | Expense list and claim | 15 | 17, 18, 22 |
| 17 | Reimbursement marker | 16 | 20 |
| 18 | Home screen | 7, 12, 16 | 22, 30 |
| 19 | Cash count | 10, 12 | 20, 28 |
| 20 | Month close and lock | 11, 12, 13, 17, 19 | 25 |
| 21 | Father link and PIN | 5, 7 | 22 |
| 22 | Father read-only views | 16, 18, 21 | 29, 30 |
| 23 | Personal tracker | 10, 15 | 29, 30 |
| 24 | Activity log screen | 7, 8 | 31 |
| 25 | Monthly statements | 20 | 26, 27, 30 |
| 26 | PDF export | 25 | 31 |
| 27 | Spreadsheet export and backups | 5, 25 | 31 |
| 28 | Email reminders | 10, 13, 19 | 31 |
| 29 | Security verification | 22, 23 | 31 |
| 30 | Mobile, PWA and RTL polish | 18, 22, 23, 25 | 32 |
| 31 | Deployment | 24, 26, 27, 28, 29 | 32 |
| 32 | User acceptance and rollout | 30, 31 | none (final) |

## Critical path

`1 → 2 → 5 → 6 → 7 → 9 → 10 → 12 → 19 → 20 → 25 → 26 → 31 → 32`

Tasks 4, 14 and 21 can run in parallel with other early work, but the order above keeps complexity growing gradually: pure calculation code first, then data, then screens, then closing the month, then the father's access, then extras and release.
