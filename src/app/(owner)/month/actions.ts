"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { isMonthKey, todayISO } from "@/lib/months";
import { run, AppError, type ActionResult } from "@/server/errors";
import { acceptDifference, correctToCount, submitCashCount } from "@/server/cashcount";
import { closeMonth } from "@/server/checklist";
import { confirmDeposit } from "@/server/ledger";
import { saveSalary, setSadaqahGiven } from "@/server/months";
import { money, optionalText, requiredText, str } from "@/server/parse";
import { requireOwner } from "@/server/session";

function monthParam(fd: FormData): string {
  const m = str(fd.get("month"));
  if (!isMonthKey(m)) throw new AppError("dateInvalid", "month");
  return m;
}

async function act(fd: FormData, fn: (month: string) => Promise<void>): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => fn(monthParam(fd)));
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function saveSalaryAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    const adjustment = str(fd.get("adjustment")) ? money(fd.get("adjustment"), "adjustment", { signed: true }) : 0;
    await saveSalary(await getDb(), month, { adjustment, note: optionalText(fd.get("note")) });
  });
}

export async function confirmDepositAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await confirmDeposit(await getDb(), month, todayISO());
  });
}

export async function sadaqahAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await setSadaqahGiven(await getDb(), month, fd.get("given") === "1");
  });
}

export async function cashCountAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await submitCashCount(await getDb(), month, money(fd.get("counted"), "counted", { allowZero: true }));
  });
}

export async function correctCountAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await correctToCount(await getDb(), month, requiredText(fd.get("reason"), "reason", 200));
  });
}

export async function acceptCountAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await acceptDifference(await getDb(), month, requiredText(fd.get("note"), "note", 200));
  });
}

export async function closeMonthAction(_p: ActionResult | undefined, fd: FormData) {
  return act(fd, async (month) => {
    await closeMonth(await getDb(), month);
  });
}
