import type { Db } from "@/db/types";
import type { Category } from "@/lib/categories";
import { calculateSplit, type Split } from "@/lib/split";
import { monthClaim, listFamilyExpenses, type FamilyExpense } from "./expenses";
import { adjustedSalary, findMonth, type Month } from "./months";
import { latestCount, type CashCount } from "./cashcount";

export interface Statement {
  month: Month;
  salary: { base: number; adjustment: number; note: string | null; adjusted: number };
  split: Split;
  savings: {
    opening: number;
    deposits: number;
    withdrawals: number;
    corrections: number;
    closing: number;
    entries: { id: number; type: string; amount: number; reason: string | null; date: string }[];
  };
  family: { total: number; count: number; breakdown: { category: Category; total: number }[]; items: FamilyExpense[] };
  reimbursed: { done: boolean; amount: number | null; at: string | null };
  sadaqahGiven: boolean;
  cashCount: CashCount | null;
}

/** Savings balance at the end of a month = every entry up to and including that month. */
async function balanceThrough(db: Db, key: string): Promise<number> {
  const [r] = await db.query<{ b: number }>(
    `select coalesce(sum(case when l.type = 'withdrawal' then -l.amount else l.amount end), 0)::bigint as b
     from ledger_entries l left join months m on m.id = l.month_id
     where l.month_id is null or m.year_month <= $1`,
    [key],
  );
  return r.b;
}

export async function buildStatement(db: Db, key: string): Promise<Statement | null> {
  const month = await findMonth(db, key);
  if (!month) return null;
  const entries = await db.query<{ id: number; type: string; amount: number; reason: string | null; entry_date: string }>(
    "select id, type, amount, reason, entry_date from ledger_entries where month_id = $1 order by id",
    [month.id],
  );
  const sum = (type: string) => entries.filter((e) => e.type === type).reduce((s, e) => s + e.amount, 0);
  const closing = await balanceThrough(db, key);
  const deposits = sum("deposit");
  const withdrawals = sum("withdrawal");
  const corrections = sum("correction");
  const claim = await monthClaim(db, month.id);
  const adjusted = adjustedSalary(month);
  return {
    month,
    salary: { base: month.salaryBase, adjustment: month.salaryAdjustment, note: month.adjustmentNote, adjusted },
    split: calculateSplit(adjusted, month.splitPercent, month.sadaqahPercent),
    savings: {
      opening: closing - deposits + withdrawals - corrections,
      deposits,
      withdrawals,
      corrections,
      closing,
      entries: entries.map((e) => ({ id: e.id, type: e.type, amount: e.amount, reason: e.reason, date: e.entry_date })),
    },
    family: {
      total: claim.total,
      count: claim.count,
      breakdown: claim.breakdown as { category: Category; total: number }[],
      items: await listFamilyExpenses(db, month.id),
    },
    reimbursed: { done: month.reimbursed, amount: month.reimbursedAmount, at: month.reimbursedAt },
    sadaqahGiven: month.sadaqahGiven,
    cashCount: await latestCount(db, month.id),
  };
}

export async function listStatementMonths(db: Db): Promise<{ key: string; status: "open" | "closed"; claim: number }[]> {
  const rows = await db.query<{ year_month: string; status: "open" | "closed"; claim: number }>(
    `select m.year_month, m.status,
       coalesce((select sum(amount) from family_expenses e where e.month_id = m.id), 0)::bigint as claim
     from months m order by m.year_month desc`,
  );
  return rows.map((r) => ({ key: r.year_month, status: r.status, claim: r.claim }));
}
