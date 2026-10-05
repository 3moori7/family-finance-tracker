import type { Db } from "@/db/types";
import { todayISO } from "@/lib/months";
import { buildWorkbook, dumpAll } from "./backup";
import { sendEmail } from "./email";
import { getSettings } from "./settings";

/** Weekly backup: the full data as JSON (restorable) plus a spreadsheet (readable), by email. */
export async function runBackupJob(db: Db, now: Date = new Date()): Promise<{ emailed: boolean; reason?: string }> {
  const settings = await getSettings(db);
  if (!settings?.reminderEmail) return { emailed: false, reason: "no-email" };
  const dump = await dumpAll(db);
  const day = todayISO(now);
  const result = await sendEmail({
    to: settings.reminderEmail,
    subject: `Family Tracker backup ${day}`,
    text:
      "Attached are a spreadsheet (to read) and a JSON file (to restore with `npm run restore`).\n" +
      "Keep these files private: they contain all of your financial records.",
    attachments: [
      { filename: `family-tracker-${day}.xlsx`, content: await buildWorkbook(dump) },
      { filename: `family-tracker-${day}.json`, content: Buffer.from(JSON.stringify(dump)) },
    ],
  });
  return { emailed: result.sent, reason: result.sent ? undefined : "provider-not-configured" };
}
