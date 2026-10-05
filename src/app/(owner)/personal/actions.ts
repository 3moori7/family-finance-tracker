"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { todayISO } from "@/lib/months";
import { AppError, run, type ActionResult } from "@/server/errors";
import { category, isoDate, money, optionalText, str } from "@/server/parse";
import { addPersonalExpense, deletePersonalExpense, updatePersonalExpense } from "@/server/personal";
import { requireOwner } from "@/server/session";

function input(fd: FormData) {
  const date = isoDate(fd.get("date"));
  if (date > todayISO()) throw new AppError("dateInvalid", "date");
  return {
    amount: money(fd.get("amount"), "amount"),
    category: category(fd.get("category")),
    date,
    note: optionalText(fd.get("note"), 200),
  };
}

export async function addPersonalAction(_p: ActionResult<{ id: number }> | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => ({ id: await addPersonalExpense(await getDb(), input(fd)) }));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updatePersonalAction(_p: ActionResult | undefined, fd: FormData) {
  await requireOwner();
  const result = await run(async () => {
    const id = Number(str(fd.get("id")));
    if (!Number.isInteger(id)) throw new AppError("notFound");
    await updatePersonalExpense(await getDb(), id, input(fd));
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function deletePersonalAction(id: number): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => deletePersonalExpense(await getDb(), Number(id)));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
