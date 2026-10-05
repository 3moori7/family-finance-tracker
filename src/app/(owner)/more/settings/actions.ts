"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db/client";
import { run, type ActionResult } from "@/server/errors";
import { emailOrNull, money, percent, str } from "@/server/parse";
import { updateSettings } from "@/server/settings";
import { requireOwner } from "@/server/session";
import { isLocale } from "@/i18n/locale";

export async function saveSettings(_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => {
    const lang = str(fd.get("language"));
    await updateSettings(await getDb(), {
      salaryAmount: money(fd.get("salary"), "salary", { allowZero: true }),
      splitPercent: percent(fd.get("splitPercent"), "splitPercent"),
      sadaqahPercent: percent(fd.get("sadaqahPercent"), "sadaqahPercent"),
      language: isLocale(lang) ? lang : "ar",
      reminderEmail: emailOrNull(fd.get("reminderEmail")),
      remindersEnabled: fd.get("remindersEnabled") === "on",
    });
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}
