import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { getOrCreateMonth, saveSalary, setSadaqahGiven } from "@/server/months";
import { confirmDeposit, getBalance } from "@/server/ledger";
import { submitCashCount } from "@/server/cashcount";
import { runReminders, targetMonths } from "@/server/reminders";
import type { Email } from "@/server/email";

let db: Db;
let outbox: Email[];
const sender = async (e: Email) => (outbox.push(e), { sent: true });
beforeEach(async () => {
  db = await createTestDb();
  outbox = [];
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 0, language: "en", reminderEmail: "me@x.co" });
});
const at = (iso: string) => new Date(`${iso}T09:00:00Z`);

describe("which months are reminded", () => {
  it("covers the last five days of a month and the first week of the next", () => {
    expect(targetMonths("2026-04-10")).toEqual([]);
    expect(targetMonths("2026-04-25")).toEqual([]);
    expect(targetMonths("2026-04-26")).toEqual([{ key: "2026-04", kind: "ending" }]);
    expect(targetMonths("2026-04-30")).toEqual([{ key: "2026-04", kind: "ending" }]);
    expect(targetMonths("2026-05-02")).toEqual([{ key: "2026-04", kind: "previous" }]);
    expect(targetMonths("2026-01-03")).toEqual([{ key: "2025-12", kind: "previous" }]);
  });
});

describe("email reminders", () => {
  it("sends the three reminders at month end, once", async () => {
    const r = await runReminders(db, at("2026-04-28"), sender);
    expect(r.sent).toEqual([{ month: "2026-04", kinds: ["salary", "sadaqah", "cashcount"] }]);
    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("me@x.co");
    expect(outbox[0].text).toContain("Confirm the salary");
    expect(outbox[0].text).toContain("/month?m=2026-04");
    // the same day, the next day: nothing more
    expect((await runReminders(db, at("2026-04-28"), sender)).sent).toEqual([]);
    expect((await runReminders(db, at("2026-04-29"), sender)).sent).toEqual([]);
    expect(outbox).toHaveLength(1);
  });

  it("only reminds about steps that are still open", async () => {
    await getOrCreateMonth(db, "2026-04");
    await saveSalary(db, "2026-04", { adjustment: 0, note: null });
    await confirmDeposit(db, "2026-04", "2026-04-27");
    await setSadaqahGiven(db, "2026-04", true);
    const r = await runReminders(db, at("2026-04-28"), sender);
    expect(r.sent).toEqual([{ month: "2026-04", kinds: ["cashcount"] }]);
    await submitCashCount(db, "2026-04", await getBalance(db));
    outbox.length = 0;
    expect((await runReminders(db, at("2026-04-30"), sender)).sent).toEqual([]);
  });

  it("catches up on a month left open when the next one starts", async () => {
    await getOrCreateMonth(db, "2026-04");
    const r = await runReminders(db, at("2026-05-02"), sender);
    expect(r.sent[0].month).toBe("2026-04");
  });

  it("respects the off switch and a missing address, and mid-month silence", async () => {
    expect((await runReminders(db, at("2026-04-15"), sender)).sent).toEqual([]);
    await db.query("update settings set reminders_enabled = false");
    expect((await runReminders(db, at("2026-04-28"), sender)).sent).toEqual([]);
    await db.query("update settings set reminders_enabled = true, reminder_email = null");
    expect((await runReminders(db, at("2026-04-28"), sender)).sent).toEqual([]);
    expect(outbox).toHaveLength(0);
  });

  it("retries tomorrow when sending fails", async () => {
    const failing = async () => ({ sent: false });
    expect((await runReminders(db, at("2026-04-28"), failing)).sent).toEqual([]);
    expect((await runReminders(db, at("2026-04-29"), sender)).sent).toHaveLength(1);
  });

  it("writes Arabic when the language is Arabic", async () => {
    await db.query("update settings set language = 'ar'");
    await runReminders(db, at("2026-04-28"), sender);
    expect(outbox[0].subject).toBe("تذكير نهاية الشهر");
  });
});
