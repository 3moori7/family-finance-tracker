"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { isMonthKey, todayISO } from "@/lib/months";
import { AppError, run, type ActionResult } from "@/server/errors";
import { addFamilyExpense, deleteFamilyExpense, markReimbursed, undoReimbursed, updateFamilyExpense } from "@/server/expenses";
import { category, isoDate, money, optionalText, str } from "@/server/parse";
import { requireOwner } from "@/server/session";

function expenseInput(fd: FormData) {
  const date = isoDate(fd.get("date"));
  if (date > todayISO()) throw new AppError("dateInvalid", "date");
  return {
    amount: money(fd.get("amount"), "amount"),
    category: category(fd.get("category")),
    date,
    note: optionalText(fd.get("note"), 200),
  };
}

export async function addExpenseAction(_p: ActionResult<{ id: number }> | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => ({ id: await addFamilyExpense(await getDb(), expenseInput(fd)) }));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateExpenseAction(_p: ActionResult | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => {
    const id = Number(str(fd.get("id")));
    if (!Number.isInteger(id)) throw new AppError("notFound");
    await updateFamilyExpense(await getDb(), id, expenseInput(fd));
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deleteExpenseAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => deleteFamilyExpense(await getDb(), Number(id)));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function reimburseAction(_p: ActionResult | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => {
    const month = str(fd.get("month"));
    if (!isMonthKey(month)) throw new AppError("dateInvalid", "month");
    const expected = Number(str(fd.get("expected")));
    await markReimbursed(await getDb(), month, Number.isInteger(expected) ? expected : undefined);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function undoReimburseAction(_p: ActionResult | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => {
    const month = str(fd.get("month"));
    if (!isMonthKey(month)) throw new AppError("dateInvalid", "month");
    await undoReimbursed(await getDb(), month);
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
