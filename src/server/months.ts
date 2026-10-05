import type { Db } from "@/db/types";
import { calculateSplit, type Split } from "@/lib/split";
import { isMonthKey, monthKeyOf, shiftMonth } from "@/lib/months";
import { AppError } from "./errors";
import { requireSettings } from "./settings";

export interface Month {
  id: number;
  key: string;
  status: "open" | "closed";
  salaryBase: number;
  splitPercent: number;
  sadaqahPercent: number;
  salaryAdjustment: number;
  adjustmentNote: string | null;
  salaryConfirmedAt: string | null;
  sadaqahGiven: boolean;
  reimbursed: boolean;
  reimbursedAmount: number | null;
  reimbursedAt: string | null;
  closedAt: string | null;
}

interface Row {
  id: number;
  year_month: string;
  status: "open" | "closed";
  salary_base: number;
  split_percent: number;
  sadaqah_percent: number;
  salary_adjustment: number;
  adjustment_note: string | null;
  salary_confirmed_at: string | null;
  sadaqah_given: boolean;
  reimbursed: boolean;
  reimbursed_amount: number | null;
  reimbursed_at: string | null;
  closed_at: string | null;
}

export function mapMonth(r: Row): Month {
  return {
    id: r.id,
    key: r.year_month,
    status: r.status,
    salaryBase: r.salary_base,
    splitPercent: r.split_percent,
    sadaqahPercent: r.sadaqah_percent,
    salaryAdjustment: r.salary_adjustment,
    adjustmentNote: r.adjustment_note,
    salaryConfirmedAt: r.salary_confirmed_at,
    sadaqahGiven: r.sadaqah_given,
    reimbursed: r.reimbursed,
    reimbursedAmount: r.reimbursed_amount,
    reimbursedAt: r.reimbursed_at,
    closedAt: r.closed_at,
  };
}

export async function findMonth(db: Db, key: string): Promise<Month | null> {
  const [r] = await db.query<Row>("select * from months where year_month = $1", [key]);
  return r ? mapMonth(r) : null;
}

/** Idempotent: creates an open month, snapshotting the current salary settings. */
export async function getOrCreateMonth(db: Db, key: string): Promise<Month> {
  if (!isMonthKey(key)) throw new AppError("dateInvalid", "month");
  const s = await requireSettings(db);
  const existing = await findMonth(db, key);
  if (existing) {
    // Until the salary is confirmed a month simply follows the current settings. (Pages render at
    // the same time as their layout, so a month can be created before the setup wizard finishes.)
    const stale =
      existing.status === "open" &&
      !existing.salaryConfirmedAt &&
      (existing.salaryBase !== s.salaryAmount ||
        existing.splitPercent !== s.splitPercent ||
        existing.sadaqahPercent !== s.sadaqahPercent);
    if (!stale) return existing;
    await db.query(
      "update months set salary_base=$2, split_percent=$3, sadaqah_percent=$4 where id=$1",
      [existing.id, s.salaryAmount, s.splitPercent, s.sadaqahPercent],
    );
    return (await findMonth(db, key))!;
  }
  await db.query(
    `insert into months (year_month, salary_base, split_percent, sadaqah_percent)
     values ($1, $2, $3, $4) on conflict (year_month) do nothing`,
    [key, s.salaryAmount, s.splitPercent, s.sadaqahPercent],
  );
  return (await findMonth(db, key))!;
}

export async function mustFindMonth(db: Db, key: string): Promise<Month> {
  const m = await findMonth(db, key);
  if (!m) throw new AppError("notFound", "month");
  return m;
}

export function adjustedSalary(m: Pick<Month, "salaryBase" | "salaryAdjustment">): number {
  return m.salaryBase + m.salaryAdjustment;
}

export function monthSplit(m: Month): Split {
  return calculateSplit(adjustedSalary(m), m.splitPercent, m.sadaqahPercent);
}

/** Months known to the app (created ones plus the calendar month), oldest first. */
export async function listMonthKeys(db: Db, now: Date = new Date()): Promise<string[]> {
  const rows = await db.query<{ year_month: string }>("select year_month from months order by year_month");
  const keys = new Set(rows.map((r) => r.year_month));
  keys.add(monthKeyOf(now));
  return [...keys].sort();
}

/** Default month to show: the oldest open month up to today's month, else today's month. */
export async function currentMonthKey(db: Db, now: Date = new Date()): Promise<string> {
  const today = monthKeyOf(now);
  const [r] = await db.query<{ year_month: string }>(
    "select year_month from months where status = 'open' and year_month <= $1 order by year_month limit 1",
    [today],
  );
  return r?.year_month ?? today;
}

export async function resolveMonthKey(db: Db, param: string | undefined, now: Date = new Date()): Promise<string> {
  // a month after the current calendar month is never a valid target (stops stray rows being created)
  if (param && isMonthKey(param) && param <= monthKeyOf(now)) return param;
  return currentMonthKey(db, now);
}

export async function neighbours(db: Db, key: string, now: Date = new Date()) {
  const keys = await listMonthKeys(db, now);
  if (!keys.includes(key)) keys.push(key);
  keys.sort();
  const i = keys.indexOf(key);
  return { prevKey: keys[i - 1] ?? null, nextKey: keys[i + 1] ?? null };
}

/** Open months that ended more than one month ago and are still not closed (soft warning). */
export async function staleOpenMonths(db: Db, now: Date = new Date()): Promise<string[]> {
  const cutoff = shiftMonth(monthKeyOf(now), -1);
  const rows = await db.query<{ year_month: string }>(
    "select year_month from months where status = 'open' and year_month < $1 order by year_month",
    [cutoff],
  );
  return rows.map((r) => r.year_month);
}

/** Step 1 of the month-end routine: confirm salary (with optional adjustment). */
export async function saveSalary(
  db: Db,
  key: string,
  input: { adjustment: number; note: string | null },
): Promise<void> {
  if (input.adjustment !== 0 && !input.note) throw new AppError("noteRequired", "note");
  const month = await getOrCreateMonth(db, key);
  const s = await requireSettings(db);
  await db.query(
    `update months set salary_base=$2, split_percent=$3, sadaqah_percent=$4,
       salary_adjustment=$5, adjustment_note=$6, salary_confirmed_at=coalesce(salary_confirmed_at, now())
     where id=$1`,
    [month.id, s.salaryAmount, s.splitPercent, s.sadaqahPercent, input.adjustment, input.adjustment === 0 ? null : input.note],
  );
}

export async function setSadaqahGiven(db: Db, key: string, given: boolean): Promise<void> {
  const m = await mustFindMonth(db, key);
  await db.query("update months set sadaqah_given=$2 where id=$1", [m.id, given]);
}
