import type { Db } from "@/db/types";
import { AppError } from "./errors";

export interface Settings {
  ownerEmail: string;
  salaryAmount: number;
  splitPercent: number;
  sadaqahPercent: number;
  language: "ar" | "en";
  reminderEmail: string | null;
  remindersEnabled: boolean;
  setupCompleted: boolean;
  hasPin: boolean;
  viewTokenVersion: number;
}

interface Row {
  owner_email: string;
  salary_amount: number;
  split_percent: number;
  sadaqah_percent: number;
  language: "ar" | "en";
  reminder_email: string | null;
  reminders_enabled: boolean;
  setup_completed: boolean;
  pin_hash: string | null;
  view_token_version: number;
}

export async function getSettings(db: Db): Promise<Settings | null> {
  const [r] = await db.query<Row>("select * from settings where id = 1");
  if (!r) return null;
  return {
    ownerEmail: r.owner_email,
    salaryAmount: r.salary_amount,
    splitPercent: r.split_percent,
    sadaqahPercent: r.sadaqah_percent,
    language: r.language,
    reminderEmail: r.reminder_email,
    remindersEnabled: r.reminders_enabled,
    setupCompleted: r.setup_completed,
    hasPin: !!r.pin_hash,
    viewTokenVersion: r.view_token_version,
  };
}

export async function requireSettings(db: Db): Promise<Settings> {
  const s = await getSettings(db);
  if (!s) throw new AppError("notFound");
  return s;
}

export interface SettingsInput {
  salaryAmount: number;
  splitPercent: number;
  sadaqahPercent: number;
  language: "ar" | "en";
  reminderEmail: string | null;
  remindersEnabled: boolean;
}

function validate(i: SettingsInput) {
  if (!Number.isInteger(i.salaryAmount) || i.salaryAmount < 0) throw new AppError("amountInvalid", "salary");
  if (i.splitPercent < 0 || i.splitPercent > 100) throw new AppError("percentInvalid", "splitPercent");
  if (i.sadaqahPercent < 0 || i.sadaqahPercent > i.splitPercent) {
    throw new AppError("percentInvalid", "sadaqahPercent");
  }
}

export async function updateSettings(db: Db, i: SettingsInput): Promise<void> {
  validate(i);
  await db.query(
    `update settings set salary_amount=$1, split_percent=$2, sadaqah_percent=$3, language=$4,
       reminder_email=$5, reminders_enabled=$6, updated_at=now() where id=1`,
    [i.salaryAmount, i.splitPercent, i.sadaqahPercent, i.language, i.reminderEmail, i.remindersEnabled],
  );
}

export interface SetupInput {
  salaryAmount: number;
  openingBalance: number;
  language: "ar" | "en";
  reminderEmail: string | null;
}

/** First-run wizard: saves settings and records today's savings total as the opening entry. */
export async function completeSetup(db: Db, i: SetupInput): Promise<void> {
  if (!Number.isInteger(i.salaryAmount) || i.salaryAmount < 0) throw new AppError("amountInvalid", "salary");
  if (!Number.isInteger(i.openingBalance) || i.openingBalance < 0) {
    throw new AppError("amountInvalid", "openingBalance");
  }
  await db.tx(async (t) => {
    const [s] = await t.query<{ setup_completed: boolean }>("select setup_completed from settings where id=1 for update");
    if (!s) throw new AppError("notFound");
    if (s.setup_completed) throw new AppError("alreadyDone");
    await t.query(
      `update settings set salary_amount=$1, language=$2, reminder_email=$3, setup_completed=true,
         updated_at=now() where id=1`,
      [i.salaryAmount, i.language, i.reminderEmail],
    );
    await t.query(
      "insert into ledger_entries(type, amount) values ('opening', $1)",
      [i.openingBalance],
    );
  });
}
