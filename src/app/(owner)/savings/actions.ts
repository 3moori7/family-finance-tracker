"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { todayISO } from "@/lib/months";
import { run, type ActionResult } from "@/server/errors";
import { addWithdrawal } from "@/server/ledger";
import { isoDate, money, requiredText, str } from "@/server/parse";
import { requireOwner } from "@/server/session";

export async function withdrawAction(_p: ActionResult | undefined, fd: FormData): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => {
    await addWithdrawal(await getDb(), {
      amount: money(fd.get("amount"), "amount"),
      reason: requiredText(fd.get("reason"), "reason"),
      date: str(fd.get("date")) ? isoDate(fd.get("date")) : todayISO(),
    });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
