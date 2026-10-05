import type { Db } from "@/db/types";
import { compareCount } from "@/lib/cashcount";
import { todayISO } from "@/lib/months";
import { AppError } from "./errors";
import { addCorrection, getBalance } from "./ledger";
import { mustFindMonth } from "./months";

export interface CashCount {
  id: number;
  counted: number;
  expected: number;
  difference: number;
  accepted: boolean;
  note: string | null;
  createdAt: string;
}

interface Row {
  id: number; counted_amount: number; expected_amount: number; difference: number;
  accepted_difference: boolean; note: string | null; created_at: string;
}
const map = (r: Row): CashCount => ({
  id: r.id, counted: r.counted_amount, expected: r.expected_amount, difference: r.difference,
  accepted: r.accepted_difference, note: r.note, createdAt: r.created_at,
});

export async function listCounts(db: Db, monthId: number): Promise<CashCount[]> {
  const rows = await db.query<Row>("select * from cash_counts where month_id=$1 order by id desc", [monthId]);
  return rows.map(map);
}

export async function latestCount(db: Db, monthId: number): Promise<CashCount | null> {
  return (await listCounts(db, monthId))[0] ?? null;
}

/** Step 5 of the month-end routine: enter the physical cash and compare with the app. */
export async function submitCashCount(db: Db, key: string, counted: number, note: string | null = null) {
  if (!Number.isInteger(counted) || counted < 0) throw new AppError("amountInvalid", "counted");
  return db.tx(async (t) => {
    const month = await mustFindMonth(t, key);
    const result = compareCount(counted, await getBalance(t));
    await t.query(
      `insert into cash_counts(month_id, counted_amount, expected_amount, difference, note)
       values ($1,$2,$3,$4,$5)`,
      [month.id, result.counted, result.expected, result.difference, note],
    );
    return result;
  });
}

/**
 * Fix a mismatch with a dated correction entry (never by editing history), then record a fresh
 * count that matches the corrected balance.
 */
export async function correctToCount(db: Db, key: string, reason: string): Promise<void> {
  if (!reason) throw new AppError("required", "reason");
  await db.tx(async (t) => {
    const month = await mustFindMonth(t, key);
    const last = await latestCount(t, month.id);
    if (!last) throw new AppError("notFound");
    if (last.difference === 0) throw new AppError("alreadyDone");
    // the app's number moved since that count: ask for a new count instead of guessing
    if (last.expected !== (await getBalance(t))) throw new AppError("alreadyDone", "counted");
    await addCorrection(t, { amount: last.difference, reason, date: todayISO(), monthKey: key });
    await submitCashCount(t, key, last.counted, reason);
  });
}

/** Keep a mismatch as is, explaining it in a note. */
export async function acceptDifference(db: Db, key: string, note: string): Promise<void> {
  if (!note) throw new AppError("noteRequired", "note");
  const month = await mustFindMonth(db, key);
  const last = await latestCount(db, month.id);
  if (!last) throw new AppError("notFound");
  await db.query("update cash_counts set accepted_difference = true, note = $2 where id = $1", [last.id, note]);
}

export type CountStatus = "none" | "match" | "accepted" | "mismatch" | "stale";

export function countStatus(last: CashCount | null, currentBalance: number): CountStatus {
  if (!last) return "none";
  if (last.expected !== currentBalance) return "stale";
  if (last.difference === 0) return "match";
  return last.accepted ? "accepted" : "mismatch";
}
