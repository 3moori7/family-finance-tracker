# PRD: Family Savings and Expenses Tracker

Status: Draft v1. All assumptions have been confirmed by the owner.

## 1. Project overview

**Problem.** Each month the owner receives a fixed salary and gives 75% of it to their father, who holds it as cash savings at home. The owner also pays many small family expenses (home items, car fuel, etc.) from their own account and asks the father to reimburse the total at month-end. Tracking this mentally no longer works, and the owner fears losing track of how much is saved and how much the father owes them.

**Solution.** A small, private, mobile-first website in Arabic (default) and English where the owner records salary, family expenses and savings, and the father has a view-only window into the numbers.

**Users**

| User | Role | Access |
|---|---|---|
| Owner | Enters all data | Edit login |
| Father | Holds the cash savings and reimburses family expenses | View-only via link + PIN |

**Success criteria**
- **Trust:** the owner and father agree on every number. The monthly cash count matches the app, or the difference is explained and recorded.
- **Peace of mind:** the owner can answer "how much do I have saved?" and "how much does Dad owe me?" in seconds, with no disputes.

**Non-goals (v1):** investment tracking or returns, bank integration, receipt photos, multiple families, partial reimbursements.

## 2. Core requirements

**Money rules**
1. **Salary** is a fixed amount set once and pre-filled each month. The owner can add or subtract an adjustment with a note, and the split uses the adjusted amount.
2. **Split:** 75% of salary goes to the father. Within that 75%, 2.5% of salary is sadaqah (not an extra amount). Savings deposit = 75% − sadaqah. The owner keeps 25%.
   - Example: salary 10,000 → 7,500 to father → 250 sadaqah + 7,250 savings; owner keeps 2,500.
3. **Sadaqah** is given out by the father. The app records only a monthly "given" status, with no recipient or date.
4. **Savings pot** is a single cash pot with no investment tracking. Balance = opening balance + deposits − withdrawals ± correction entries. Withdrawals are rare and each needs a reason.
5. **Family expenses** are logged by the owner (amount, category, date, optional note). The month's total is the claim on the father. He pays the full amount once and the owner marks the month **reimbursed**.
6. **Cash count** is done monthly. The app compares the counted cash to the expected balance. A mismatch shows a warning and allows a dated correction entry with a reason; nothing is silently overwritten.
7. **Opening balance:** at setup the owner enters today's savings total. Past months are not re-entered.
8. **Closed months are locked.** Changes happen only through correction entries.

**Non-functional requirements**
- Mobile-first; both users are on phones.
- Bilingual: Arabic (default, RTL) and English with a toggle. Amounts in SAR (ر.س).
- Quick expense entry should take a few seconds.
- Free hosting, small data volume (two users). Automatic backups are required, because the app is the only written record of cash savings.
- Privacy: the father needs link + PIN; the owner has a separate edit login.

## 3. Core features

**Version 1**
1. Salary entry with adjustment and automatic split.
2. Quick family-expense entry with fixed categories (starter list: Home, Car and fuel, Groceries, Other).
3. Reimbursement tracking: running claim total, "reimbursed" marker per month.
4. Savings ledger: opening balance, monthly deposits, withdrawals with reasons, correction entries.
5. Sadaqah monthly "given" status.
6. Monthly cash count with mismatch warning and correction entry.
7. Guided month-end close that locks the month.
8. Father's view-only access (link + PIN).
9. Optional personal spending tracker (owner only, hidden from the father): quick entry, "estimated left this month" (25% minus logged spending, labelled an estimate) and a category breakdown. It never blocks the core flow or nags.
10. Email reminders: month-end cash count, enter the salary, sadaqah not yet marked given.
11. Monthly statements: a page per month (salary, split, family spending by category, reimbursement, cash-count result) that can be opened for any past month and exported as PDF.
12. Data export: download all data as a spreadsheet, plus automatic backups.
13. Activity log: every entry, edit and deletion is recorded with a timestamp and cannot be silently removed.

**Later**
- Bank SMS or statement import, receipt photos.
- Partial reimbursements, investment tracking.

## 4. Core components

**Screens**
- **Home:** two cards, (1) savings balance, (2) family expenses to claim this month. The father sees the same cards without edit controls.
- **Salary and split:** monthly entry, adjustment, breakdown.
- **Quick expense entry:** amount, category, date, optional note.
- **Savings ledger:** deposits, withdrawals with reasons, corrections.
- **Family expenses summary (father's view):** running total and per-category breakdown only, with no individual items. Live during the month.
- **Cash count:** enter the count, compare to expected, resolve a mismatch.
- **Month close:** checklist of the month-end steps.
- **Personal tracker:** owner only.
- **Monthly statements:** list of past months, each openable and exportable as PDF.
- **Activity log:** read-only history of every change (the father may view it).
- **Export and backup:** spreadsheet download and backup status.
- **Settings:** salary amount, categories, PIN, language, reminder email.

**Data model (high level)**
- `settings`: salary_amount, split_percent (75), sadaqah_percent (2.5), language, pin_hash.
- `months`: id, year_month, status (open, closed), salary_adjustment, adjustment_note, sadaqah_given, reimbursed, closed_at.
- `ledger_entries`: id, month_id, type (opening, deposit, withdrawal, correction), amount, reason, created_at.
- `family_expenses`: id, month_id, amount, category, date, note.
- `cash_counts`: id, month_id, counted_amount, expected_amount, difference, created_at.
- `personal_expenses`: id, amount, category, date, note (owner only).
- `activity_log`: id, entity, entity_id, action (create, edit, delete), old_value, new_value, created_at.

**Calculations**
- Deposit = salary × 75% − salary × 2.5%.
- Savings balance = sum of ledger entries (signed).
- Claim = sum of the open month's family expenses.
- Estimated personal money left = salary × 25% − sum of personal expenses.

## 5. App / user flow

**Daily use (owner):** open the site → quick-add a family expense (or a personal expense) → done.

**Month-end routine (confirmed)**
1. Enter the salary, adjust if needed, and see the split.
2. Confirm the deposit to the father.
3. Mark sadaqah as given.
4. Review family expenses, the father pays, mark the month reimbursed (the claim covers the month being closed, with expenses assigned to a month by their date).
5. Cash count with owner and father; a warning appears on mismatch and a correction entry can be added.
6. Close and lock the month.

**Father:** opens the link → enters the PIN → sees the savings balance, the family-expense total and category breakdown. He cannot edit, and he cannot see the personal tracker.

**Setup (once):** set salary and PIN → enter the opening savings balance → choose the language and reminder email.

## 6. Tech stack

Recommended, free-tier friendly (open to change):

| Layer | Choice | Reason |
|---|---|---|
| Frontend | Next.js (React) with Tailwind CSS, PWA enabled | Mobile-first, RTL support, installable to the home screen |
| i18n | next-intl (Arabic default, English) | Bilingual with RTL |
| Backend / DB | Supabase (Postgres, auth, row-level security) | Free tier, owner login, built-in backups to configure |
| Hosting | Vercel free tier | Simple deploys |
| Email reminders | Resend (free tier) plus a scheduled job (Supabase cron or Vercel cron) | Free, reliable email |
| Father's access | Signed link + PIN checked server-side, read-only role | No account for the father |

Backup: scheduled export of the database to the owner's email or cloud storage, since free tiers may not include point-in-time recovery.

## 7. Implementation plan

**Phase 0: Setup (1 to 2 days)**
- Create the project, repo, Supabase project and hosting. Set up Arabic/English RTL and base layout.

**Phase 1: Core ledger (about 1 week)**
- Data model and owner login. Settings and opening balance.
- Salary entry, adjustment, split calculation.
- Savings ledger with deposits, withdrawals and reasons.

**Phase 2: Family expenses and reimbursement (about 1 week)**
- Quick expense entry with categories. Running claim total. Reimbursed marker.

**Phase 3: Cash count and month close (about 1 week)**
- Cash count with mismatch warning and correction entries. Sadaqah status. Guided close and month lock.

**Phase 4: Father's view and security (3 to 5 days)**
- Link + PIN access, read-only views, hide the personal tracker. Test that no write is possible.

**Phase 5: Optional tracker and reminders (about 1 week)**
- Personal spending tracker. Email reminders. Automated backups.

**Phase 6: Statements, export and activity log (about 1 week)**
- Activity log written on every change (add it from Phase 1 onward so no history is missed). Monthly statement pages and PDF. Spreadsheet export.

**Phase 7: Testing and rollout (3 to 5 days)**
- Verify calculations against the owner's real recent months. Test on real phones in Arabic and English. Enter opening balances, run one live month and compare with the first cash count.

**Later:** SMS import, receipt photos, partial reimbursements, investment tracking.

**Risks**
- Cash savings have no external record; mitigate with monthly counts and backups.
- The personal tracker may be neglected; keep it fully optional.
- The PIN link could leak; use a PIN, a read-only role and the ability to rotate the link.

## 8. Decisions confirmed

- Monthly statements, data export and the activity log are in v1.
- The personal tracker is hidden from the father.
- Salary adjustments feed the 75% split.
- The father sees family-expense totals and the category breakdown live.

## 9. Previously assumed, now confirmed

- Closed months are locked, with changes only via correction entries.
- The family-expense claim covers the month being closed; an expense belongs to the month of its date.
- Email reminders also cover entering the salary and marking sadaqah as given.
- The father can view the activity log.

## 10. Implementation notes (as built)

Decisions made while building that refine or deviate from the sections above.

- **Authentication:** the owner login and Dad's link + PIN are implemented in the app (scrypt password hashes,
  signed HTTP-only cookies, rate limiting) instead of Supabase Auth. Supabase is used as the hosted Postgres only,
  and every table has row-level security with no policies, so the public Supabase keys can read nothing.
- **Database access in development:** an embedded Postgres (PGlite) is used locally and in tests, so Docker is not
  needed. Production uses `DATABASE_URL`. The production driver is also tested over the real Postgres protocol.
- **Money** is stored as whole halalas; the split rounds `fatherShare` and `sadaqah` and derives the rest, so the
  parts always add up to the salary.
- **Time zone:** "today" and month keys always use Asia/Riyadh.
- **PDF:** statements are saved as PDF through the browser's print dialog (print-optimised page). Arabic shaping
  in server-side PDF libraries is unreliable, and the browser output was checked in both languages.
- **Dad's change history** shows savings movements, cash counts and month status changes only. Itemised family
  expenses, the personal tracker, settings and salary figures are never included.
- **Dad's PIN link** is shown once; only a hash is stored. Creating a new link or changing the PIN signs Dad out.
- **Backups** never contain the password, PIN or link hashes. After a restore the owner runs `npm run create-owner`
  and turns Dad's access on again.
- **Closing a month** also requires that the cash count is still current (the savings balance has not moved since).
- **Months follow the settings** until the salary is confirmed; after the deposit is confirmed they are frozen.
- **Not done in code, because they need your own accounts or real-life use:** the Supabase / Vercel / Resend setup
  and production verification (task 31, see DEPLOY.md) and the live acceptance month (task 32).
