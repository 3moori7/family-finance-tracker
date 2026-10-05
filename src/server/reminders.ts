import type { Db } from "@/db/types";
import { daysInMonth, shiftMonth, todayISO } from "@/lib/months";
import { appUrl } from "./env";
import { latestCount, countStatus } from "./cashcount";
import { sendEmail, type EmailSender } from "./email";
import { getBalance, hasDeposit } from "./ledger";
import { findMonth } from "./months";
import { getSettings } from "./settings";

export type ReminderKind = "salary" | "sadaqah" | "cashcount";

const TEXT = {
  ar: {
    subject: "تذكير نهاية الشهر",
    intro: "بقيت هذه الخطوات لإغلاق شهر {month}:",
    salary: "• أكّد الراتب وسجّل إيداع المدخرات",
    sadaqah: "• سجّل أن الصدقة أُخرجت",
    cashcount: "• اجرد النقد مع والدك",
    open: "افتح التطبيق: {url}",
  },
  en: {
    subject: "Month-end reminder",
    intro: "These steps are left to close {month}:",
    salary: "• Confirm the salary and record the savings deposit",
    sadaqah: "• Mark the sadaqah as given",
    cashcount: "• Count the cash with Dad",
    open: "Open the app: {url}",
  },
} as const;

/** Months worth reminding about today: the current one near its end, the previous one if still open early on. */
export function targetMonths(today: string): { key: string; kind: "ending" | "previous" }[] {
  const key = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const out: { key: string; kind: "ending" | "previous" }[] = [];
  if (day >= daysInMonth(key) - 4) out.push({ key, kind: "ending" });
  if (day <= 7) out.push({ key: shiftMonth(key, -1), kind: "previous" });
  return out;
}

export async function runReminders(
  db: Db,
  now: Date = new Date(),
  sender?: EmailSender,
): Promise<{ sent: { month: string; kinds: ReminderKind[] }[] }> {
  const settings = await getSettings(db);
  const result: { sent: { month: string; kinds: ReminderKind[] }[] } = { sent: [] };
  if (!settings?.remindersEnabled || !settings.reminderEmail || !settings.setupCompleted) return result;

  const send = sender ?? sendEmail;
  const text = TEXT[settings.language];
  const balance = await getBalance(db);

  for (const target of targetMonths(todayISO(now))) {
    const month = await findMonth(db, target.key);
    // a previous month that doesn't exist or is already closed needs nothing
    if (target.kind === "previous" && (!month || month.status === "closed")) continue;
    if (month?.status === "closed") continue;

    const due: ReminderKind[] = [];
    const deposited = month ? await hasDeposit(db, month.id) : false;
    if (!month?.salaryConfirmedAt || !deposited) due.push("salary");
    if (!month?.sadaqahGiven) due.push("sadaqah");
    const last = month ? await latestCount(db, month.id) : null;
    const status = countStatus(last, balance);
    if (status !== "match" && status !== "accepted") due.push("cashcount");

    const already = await db.query<{ kind: ReminderKind }>("select kind from reminder_log where month_key = $1", [target.key]);
    const sentKinds = new Set(already.map((r) => r.kind));
    const fresh = due.filter((k) => !sentKinds.has(k));
    if (fresh.length === 0) continue;

    const body = [
      text.intro.replace("{month}", target.key),
      ...fresh.map((k) => text[k]),
      "",
      text.open.replace("{url}", `${appUrl()}/month?m=${target.key}`),
    ].join("\n");
    const res = await send({ to: settings.reminderEmail, subject: text.subject, text: body });
    if (res.sent) {
      for (const kind of fresh) {
        await db.query("insert into reminder_log(month_key, kind) values ($1,$2) on conflict do nothing", [target.key, kind]);
      }
      result.sent.push({ month: target.key, kinds: fresh });
    }
  }
  return result;
}
