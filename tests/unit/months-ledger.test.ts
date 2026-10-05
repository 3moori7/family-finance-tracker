import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import {
  currentMonthKey, getOrCreateMonth, monthSplit, neighbours, resolveMonthKey, saveSalary,
  setSadaqahGiven, staleOpenMonths, findMonth,
} from "@/server/months";
import { addCorrection, addWithdrawal, confirmDeposit, getBalance, listLedger } from "@/server/ledger";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
});

describe("month lifecycle", () => {
  it("creates a month once, snapshotting salary settings", async () => {
    const a = await getOrCreateMonth(db, "2026-03");
    const b = await getOrCreateMonth(db, "2026-03");
    expect(a.id).toBe(b.id);
    expect(a.salaryBase).toBe(1000000);
    expect(a.status).toBe("open");
    await expect(getOrCreateMonth(db, "2026-13")).rejects.toMatchObject({ code: "dateInvalid" });
  });

  it("resolves the current month: oldest open month up to today, else today", async () => {
    const now = new Date("2026-04-03T09:00:00Z");
    expect(await currentMonthKey(db, now)).toBe("2026-04");
    await getOrCreateMonth(db, "2026-03");
    expect(await currentMonthKey(db, now)).toBe("2026-03");
    expect(await resolveMonthKey(db, "2026-02", now)).toBe("2026-02");
    expect(await resolveMonthKey(db, "bad", now)).toBe("2026-03");
    expect(await neighbours(db, "2026-03", now)).toEqual({ prevKey: null, nextKey: "2026-04" });
  });

  it("warns about months left open for too long", async () => {
    await getOrCreateMonth(db, "2026-01");
    await getOrCreateMonth(db, "2026-03");
    expect(await staleOpenMonths(db, new Date("2026-04-03T09:00:00Z"))).toEqual(["2026-01"]);
  });
});

describe("months follow the settings until the salary is confirmed", () => {
  it("fixes a month that was created before the setup finished", async () => {
    await db.query("update settings set salary_amount = 0");
    await getOrCreateMonth(db, "2026-03"); // like a page rendering before the wizard completes
    await db.query("update settings set salary_amount = 1000000");
    expect((await getOrCreateMonth(db, "2026-03")).salaryBase).toBe(1000000);
  });
  it("never rewrites a confirmed month", async () => {
    await saveSalary(db, "2026-03", { adjustment: 0, note: null });
    await db.query("update settings set salary_amount = 5");
    expect((await getOrCreateMonth(db, "2026-03")).salaryBase).toBe(1000000);
  });
  it("ignores future months in the URL", async () => {
    const now = new Date("2026-04-03T09:00:00Z");
    expect(await resolveMonthKey(db, "2099-01", now)).toBe("2026-04");
    expect(await resolveMonthKey(db, "2026-04", now)).toBe("2026-04");
  });
});

describe("salary and split", () => {
  it("applies an adjustment and computes the split from the adjusted salary", async () => {
    await saveSalary(db, "2026-03", { adjustment: 50000, note: "bonus" });
    const m = (await findMonth(db, "2026-03"))!;
    expect(m.salaryAdjustment).toBe(50000);
    expect(m.salaryConfirmedAt).not.toBeNull();
    const s = monthSplit(m);
    expect(s.salary).toBe(1050000);
    expect(s.fatherShare).toBe(787500);
    expect(s.sadaqah).toBe(26250);
    expect(s.ownerKeeps).toBe(262500);
  });
  it("requires a note for non-zero adjustments", async () => {
    await expect(saveSalary(db, "2026-03", { adjustment: -100, note: null })).rejects.toMatchObject({ code: "noteRequired" });
    await saveSalary(db, "2026-03", { adjustment: 0, note: null });
  });
  it("re-snapshots settings until the deposit is confirmed, then freezes", async () => {
    await saveSalary(db, "2026-03", { adjustment: 0, note: null });
    await db.query("update settings set salary_amount = 1200000");
    await saveSalary(db, "2026-03", { adjustment: 0, note: null });
    expect((await findMonth(db, "2026-03"))!.salaryBase).toBe(1200000);
    await confirmDeposit(db, "2026-03", "2026-03-28");
    await expect(saveSalary(db, "2026-03", { adjustment: 100, note: "x" })).rejects.toThrow(/deposit_exists/);
  });
});

describe("savings ledger", () => {
  it("confirms the deposit exactly once, after salary is confirmed", async () => {
    await getOrCreateMonth(db, "2026-03");
    await expect(confirmDeposit(db, "2026-03", "2026-03-28")).rejects.toMatchObject({ code: "salary_not_confirmed" });
    await saveSalary(db, "2026-03", { adjustment: 0, note: null });
    expect(await confirmDeposit(db, "2026-03", "2026-03-28")).toBe(725000);
    expect(await getBalance(db)).toBe(2500000 + 725000);
    await expect(confirmDeposit(db, "2026-03", "2026-03-28")).rejects.toMatchObject({ code: "alreadyDone" });
  });

  it("withdraws with a reason and never beyond the balance", async () => {
    await addWithdrawal(db, { amount: 500000, reason: "Car repair", date: "2026-03-10" });
    expect(await getBalance(db)).toBe(2000000);
    await expect(addWithdrawal(db, { amount: 2000001, reason: "x", date: "2026-03-10" })).rejects.toMatchObject({ code: "insufficient_balance" });
    await expect(addWithdrawal(db, { amount: 100, reason: "", date: "2026-03-10" })).rejects.toMatchObject({ code: "required" });
  });

  it("lists entries newest first and supports corrections", async () => {
    // dates after the opening entry (dated today) so the order is unambiguous
    await addWithdrawal(db, { amount: 100, reason: "a", date: "2099-03-10" });
    await addCorrection(db, { amount: -50, reason: "miscount", date: "2099-03-12" });
    await addCorrection(db, { amount: 20, reason: "found cash", date: "2099-03-13" });
    const list = await listLedger(db);
    expect(list.map((e) => e.type)).toEqual(["correction", "correction", "withdrawal", "opening"]);
    expect(await getBalance(db)).toBe(2500000 - 100 - 50 + 20);
    await expect(addCorrection(db, { amount: 0, reason: "x", date: "2026-03-13" })).rejects.toMatchObject({ code: "amountZero" });
  });

  it("sadaqah status does not change the balance", async () => {
    await getOrCreateMonth(db, "2026-03");
    const before = await getBalance(db);
    await setSadaqahGiven(db, "2026-03", true);
    expect((await findMonth(db, "2026-03"))!.sadaqahGiven).toBe(true);
    expect(await getBalance(db)).toBe(before);
    await setSadaqahGiven(db, "2026-03", false);
    expect((await findMonth(db, "2026-03"))!.sadaqahGiven).toBe(false);
  });
});
