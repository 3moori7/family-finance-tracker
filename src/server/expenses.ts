import type { Db } from "@/db/types";
import { categoryBreakdown, familyClaim } from "@/lib/balances";
import type { Category } from "@/lib/categories";
import { monthKeyOf } from "@/lib/months";
import { AppError } from "./errors";
import { getOrCreateMonth, mustFindMonth } from "./months";

export interface FamilyExpense {
  id: number;
  amount: number;
  category: Category;
  date: string;
  note: string | null;
}

interface Row {
  id: number;
  amount: number;
  category: Category;
  expense_date: string;
  note: string | null;
}
const map = (r: Row): FamilyExpense => ({
  id: r.id, amount: r.amount, category: r.category, date: r.expense_date, note: r.note,
});

export interface ExpenseInput {
  amount: number;
  category: Category;
  date: string;
  note: string | null;
}

export async function addFamilyExpense(db: Db, i: ExpenseInput): Promise<number> {
  if (i.amount <= 0) throw new AppError("amountPositive", "amount");
  const month = await getOrCreateMonth(db, monthKeyOf(i.date));
  const [r] = await db.query<{ id: number }>(
    `insert into family_expenses(month_id, amount, category, expense_date, note)
     values ($1,$2,$3,$4,$5) returning id`,
    [month.id, i.amount, i.category, i.date, i.note],
  );
  return r.id;
}

export async function updateFamilyExpense(db: Db, id: number, i: ExpenseInput): Promise<void> {
  if (i.amount <= 0) throw new AppError("amountPositive", "amount");
  const month = await getOrCreateMonth(db, monthKeyOf(i.date));
  const rows = await db.query(
    `update family_expenses set month_id=$2, amount=$3, category=$4, expense_date=$5, note=$6
     where id=$1 returning id`,
    [id, month.id, i.amount, i.category, i.date, i.note],
  );
  if (rows.length === 0) throw new AppError("notFound");
}

export async function deleteFamilyExpense(db: Db, id: number): Promise<void> {
  const rows = await db.query("delete from family_expenses where id=$1 returning id", [id]);
  if (rows.length === 0) throw new AppError("notFound");
}

export async function listFamilyExpenses(db: Db, monthId: number): Promise<FamilyExpense[]> {
  const rows = await db.query<Row>(
    "select id, amount, category, expense_date, note from family_expenses where month_id=$1 order by expense_date desc, id desc",
    [monthId],
  );
  return rows.map(map);
}

export async function getFamilyExpense(db: Db, id: number): Promise<(FamilyExpense & { monthKey: string }) | null> {
  const [r] = await db.query<Row & { year_month: string }>(
    `select e.id, e.amount, e.category, e.expense_date, e.note, m.year_month
     from family_expenses e join months m on m.id = e.month_id where e.id=$1`,
    [id],
  );
  return r ? { ...map(r), monthKey: r.year_month } : null;
}

export async function monthClaim(db: Db, monthId: number) {
  const list = await listFamilyExpenses(db, monthId);
  return { total: familyClaim(list), breakdown: categoryBreakdown(list), count: list.length };
}

/** Step 4 of the month-end routine: Dad paid the full claim. */
export async function markReimbursed(db: Db, key: string, expectedTotal?: number): Promise<number> {
  return db.tx(async (t) => {
    const month = await mustFindMonth(t, key);
    if (month.reimbursed) throw new AppError("alreadyDone");
    const { total } = await monthClaim(t, month.id);
    if (expectedTotal !== undefined && expectedTotal !== total) throw new AppError("alreadyDone", "total");
    await t.query("update months set reimbursed=true, reimbursed_amount=$2, reimbursed_at=now() where id=$1", [month.id, total]);
    return total;
  });
}

/** Undo a mistaken reimbursement mark (only while the month is still open). */
export async function undoReimbursed(db: Db, key: string): Promise<void> {
  const month = await mustFindMonth(db, key);
  await db.query("update months set reimbursed=false, reimbursed_amount=null, reimbursed_at=null where id=$1", [month.id]);
}
