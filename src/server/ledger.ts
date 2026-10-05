import type { Db } from "@/db/types";
import { monthKeyOf } from "@/lib/months";
import { AppError } from "./errors";
import { getOrCreateMonth, monthSplit, mustFindMonth } from "./months";

export interface LedgerEntry {
  id: number;
  type: "opening" | "deposit" | "withdrawal" | "correction";
  amount: number;
  reason: string | null;
  entryDate: string;
  monthKey: string | null;
  createdAt: string;
}

export async function getBalance(db: Db): Promise<number> {
  const [r] = await db.query<{ b: number }>("select savings_balance() as b");
  return r.b;
}

export async function listLedger(db: Db): Promise<LedgerEntry[]> {
  const rows = await db.query<{
    id: number; type: LedgerEntry["type"]; amount: number; reason: string | null;
    entry_date: string; created_at: string; year_month: string | null;
  }>(
    `select l.id, l.type, l.amount, l.reason, l.entry_date, l.created_at, m.year_month
     from ledger_entries l left join months m on m.id = l.month_id
     order by l.entry_date desc, l.id desc`,
  );
  return rows.map((r) => ({
    id: r.id, type: r.type, amount: r.amount, reason: r.reason,
    entryDate: r.entry_date, monthKey: r.year_month, createdAt: r.created_at,
  }));
}

/** Step 2 of the month-end routine: record the savings deposit handed to Dad. */
export async function confirmDeposit(db: Db, key: string, today: string): Promise<number> {
  return db.tx(async (t) => {
    const month = await mustFindMonth(t, key);
    if (!month.salaryConfirmedAt) throw new AppError("salary_not_confirmed");
    const amount = monthSplit(month).savingsDeposit;
    try {
      await t.query(
        "insert into ledger_entries(month_id, type, amount, reason, entry_date) values ($1,'deposit',$2,$3,$4)",
        [month.id, amount, null, today],
      );
    } catch (e) {
      if (String(e instanceof Error ? e.message : e).includes("ledger_one_deposit_per_month")) {
        throw new AppError("alreadyDone");
      }
      throw e;
    }
    return amount;
  });
}

export async function hasDeposit(db: Db, monthId: number): Promise<boolean> {
  const rows = await db.query("select 1 from ledger_entries where month_id=$1 and type='deposit'", [monthId]);
  return rows.length > 0;
}

export async function addWithdrawal(
  db: Db,
  input: { amount: number; reason: string; date: string },
): Promise<void> {
  if (input.amount <= 0) throw new AppError("amountPositive", "amount");
  if (!input.reason) throw new AppError("required", "reason");
  await db.tx(async (t) => {
    if (input.amount > (await getBalance(t))) throw new AppError("insufficient_balance", "amount");
    const month = await getOrCreateMonth(t, monthKeyOf(input.date));
    await t.query(
      "insert into ledger_entries(month_id, type, amount, reason, entry_date) values ($1,'withdrawal',$2,$3,$4)",
      [month.id, input.amount, input.reason, input.date],
    );
  });
}

/** Signed correction (used by cash-count mismatches and manual fixes). Allowed in closed months. */
export async function addCorrection(
  db: Db,
  input: { amount: number; reason: string; date: string; monthKey?: string },
): Promise<void> {
  if (input.amount === 0) throw new AppError("amountZero", "amount");
  if (!input.reason) throw new AppError("required", "reason");
  await db.tx(async (t) => {
    const month = await getOrCreateMonth(t, input.monthKey ?? monthKeyOf(input.date));
    await t.query(
      "insert into ledger_entries(month_id, type, amount, reason, entry_date) values ($1,'correction',$2,$3,$4)",
      [month.id, input.amount, input.reason, input.date],
    );
  });
}
