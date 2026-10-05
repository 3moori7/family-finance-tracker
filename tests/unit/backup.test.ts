import { beforeEach, describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { saveSalary, setSadaqahGiven } from "@/server/months";
import { addWithdrawal, confirmDeposit, getBalance } from "@/server/ledger";
import { addFamilyExpense, markReimbursed } from "@/server/expenses";
import { addPersonalExpense } from "@/server/personal";
import { submitCashCount } from "@/server/cashcount";
import { closeMonth } from "@/server/checklist";
import { setupFatherAccess } from "@/server/father";
import { buildStatement } from "@/server/statement";
import { buildWorkbook, dumpAll, restoreAll } from "@/server/backup";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: "me@x.co" });
  await setupFatherAccess(db, "4321");
  await saveSalary(db, "2026-03", { adjustment: 50000, note: "bonus" });
  await confirmDeposit(db, "2026-03", "2026-03-28");
  await setSadaqahGiven(db, "2026-03", true);
  await addFamilyExpense(db, { amount: 8000, category: "car", date: "2026-03-02", note: "fuel" });
  await addWithdrawal(db, { amount: 100000, reason: "Emergency", date: "2026-03-12" });
  await addPersonalExpense(db, { amount: 3000, category: "other", date: "2026-03-05", note: "coffee" });
  await markReimbursed(db, "2026-03");
  await submitCashCount(db, "2026-03", await getBalance(db));
  await closeMonth(db, "2026-03");
});

describe("backup", () => {
  it("never includes password, PIN or link hashes", async () => {
    const json = JSON.stringify(await dumpAll(db));
    expect(json).not.toContain("scrypt$");
    const dump = JSON.parse(json);
    for (const key of ["owner_password_hash", "view_token_hash", "pin_hash"]) {
      expect(dump.tables.settings[0]).not.toHaveProperty(key);
    }
    // the activity log only ever holds a masked marker, never a real hash
    expect(json).not.toMatch(/"(owner_password_hash|pin_hash|view_token_hash)":"[^\[]/);
  });

  it("restores an exact copy into an empty database, including closed months and the log", async () => {
    const dump = await dumpAll(db);
    const fresh = await createTestDb();
    await restoreAll(fresh, dump);

    const again = await dumpAll(fresh);
    expect(again.tables).toEqual(dump.tables);
    expect(await getBalance(fresh)).toBe(await getBalance(db));
    expect(await buildStatement(fresh, "2026-03")).toEqual(await buildStatement(db, "2026-03"));

    // sequences continue after the restored ids and rules still apply
    await addFamilyExpense(fresh, { amount: 100, category: "home", date: "2026-04-02", note: null });
    await expect(addFamilyExpense(fresh, { amount: 1, category: "home", date: "2026-03-20", note: null })).rejects.toThrow(/month_closed/);
    await expect(fresh.query("update activity_log set entity = 'x'")).rejects.toThrow(/activity_log_immutable/);
    // the owner cannot log in until the password is reset
    const [s] = await fresh.query<{ owner_password_hash: string }>("select owner_password_hash from settings");
    expect(s.owner_password_hash).toBe("!locked");
  });

  it("refuses to restore into a database that already has data", async () => {
    await expect(restoreAll(db, await dumpAll(db))).rejects.toThrow(/not empty/);
  });

  it("builds a readable spreadsheet with amounts in SAR", async () => {
    const buf = await buildWorkbook(await dumpAll(db));
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "Months", "Savings ledger", "Family expenses", "Personal expenses", "Cash counts", "Activity log",
    ]);
    const fam = wb.getWorksheet("Family expenses")!;
    expect(fam.getRow(2).getCell("D").value).toBe(80);
    const led = wb.getWorksheet("Savings ledger")!;
    const amounts = led.getColumn("D").values.slice(2);
    expect(amounts).toContain(25000);
    expect(amounts).toContain(7612.5);
  });
});

import { runBackupJob } from "@/server/backup-job";
import { setEmailSender, type Email } from "@/server/email";
import { authorizeCron } from "@/server/cron";

describe("backup job and cron auth", () => {
  it("emails both files to the reminder email, once per run", async () => {
    const sent: Email[] = [];
    setEmailSender(async (e) => (sent.push(e), { sent: true }));
    const r = await runBackupJob(db, new Date("2026-04-05T03:00:00Z"));
    setEmailSender(null);
    expect(r).toEqual({ emailed: true });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("me@x.co");
    expect(sent[0].attachments?.map((a) => a.filename)).toEqual(["family-tracker-2026-04-05.xlsx", "family-tracker-2026-04-05.json"]);
    const json = JSON.parse(sent[0].attachments![1].content.toString());
    expect(json.tables.months).toHaveLength(1);
  });

  it("skips when there is no email address", async () => {
    await db.query("update settings set reminder_email = null");
    expect(await runBackupJob(db)).toEqual({ emailed: false, reason: "no-email" });
  });

  it("only accepts the right bearer secret", () => {
    process.env.CRON_SECRET = "s3cret-value";
    const req = (h?: string) => new Request("http://x", { headers: h ? { authorization: h } : {} });
    expect(authorizeCron(req("Bearer s3cret-value"))).toBe(true);
    expect(authorizeCron(req("Bearer nope"))).toBe(false);
    expect(authorizeCron(req())).toBe(false);
    delete process.env.CRON_SECRET;
    expect(authorizeCron(req("Bearer s3cret-value"))).toBe(false);
  });
});
