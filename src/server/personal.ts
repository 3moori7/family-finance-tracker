import type { Db } from "@/db/types";
import { categoryBreakdown, personalLeft } from "@/lib/balances";
import type { Category } from "@/lib/categories";
import { AppError } from "./errors";

export interface PersonalExpense {
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
const map = (r: Row): PersonalExpense => ({
  id: r.id, amount: r.amount, category: r.category, date: r.expense_date, note: r.note,
});

export interface PersonalInput {
  amount: number;
  category: Category;
  date: string;
  note: string | null;
}

export async function addPersonalExpense(db: Db, i: PersonalInput): Promise<number> {
  if (i.amount <= 0) throw new AppError("amountPositive", "amount");
  const [r] = await db.query<{ id: number }>(
    "insert into personal_expenses(amount, category, expense_date, note) values ($1,$2,$3,$4) returning id",
    [i.amount, i.category, i.date, i.note],
  );
  return r.id;
}

export async function updatePersonalExpense(db: Db, id: number, i: PersonalInput): Promise<void> {
  if (i.amount <= 0) throw new AppError("amountPositive", "amount");
  const rows = await db.query(
    "update personal_expenses set amount=$2, category=$3, expense_date=$4, note=$5 where id=$1 returning id",
    [id, i.amount, i.category, i.date, i.note],
  );
  if (rows.length === 0) throw new AppError("notFound");
}

export async function deletePersonalExpense(db: Db, id: number): Promise<void> {
  const rows = await db.query("delete from personal_expenses where id=$1 returning id", [id]);
  if (rows.length === 0) throw new AppError("notFound");
}

export async function getPersonalExpense(db: Db, id: number): Promise<PersonalExpense | null> {
  const [r] = await db.query<Row>("select id, amount, category, expense_date, note from personal_expenses where id=$1", [id]);
  return r ? map(r) : null;
}

export async function listPersonal(db: Db, monthKey: string): Promise<PersonalExpense[]> {
  const rows = await db.query<Row>(
    `select id, amount, category, expense_date, note from personal_expenses
     where to_char(expense_date, 'YYYY-MM') = $1 order by expense_date desc, id desc`,
    [monthKey],
  );
  return rows.map(map);
}

/** "Estimated left" is the owner's share minus whatever was logged; logging is optional. */
export async function personalSummary(db: Db, monthKey: string, ownerKeeps: number) {
  const list = await listPersonal(db, monthKey);
  const total = list.reduce((s, e) => s + e.amount, 0);
  return { list, total, breakdown: categoryBreakdown(list), left: personalLeft(ownerKeeps, list), count: list.length };
}
