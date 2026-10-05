"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { run, type ActionResult } from "@/server/errors";
import { emailOrNull, money, str } from "@/server/parse";
import { completeSetup } from "@/server/settings";
import { requireOwner } from "@/server/session";
import { isLocale } from "@/i18n/locale";
import { setLocale } from "../actions/locale";

export async function submitSetup(_prev: ActionResult | undefined, fd: FormData): Promise<ActionResult> {
  await requireOwner();
  const result = await run(async () => {
    const lang = str(fd.get("language"));
    await completeSetup(await getDb(), {
      salaryAmount: money(fd.get("salary"), "salary", { allowZero: true }),
      openingBalance: money(fd.get("opening"), "opening", { allowZero: true }),
      language: isLocale(lang) ? lang : "ar",
      reminderEmail: emailOrNull(fd.get("email"), "email"),
    });
    if (isLocale(lang)) await setLocale(lang);
  });
  if (result.ok) redirect("/");
  return result;
}
