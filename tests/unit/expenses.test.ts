import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { findMonth, getOrCreateMonth } from "@/server/months";
import {
  addFamilyExpense, deleteFamilyExpense, getFamilyExpense, listFamilyExpenses, markReimbursed,
  monthClaim, undoReimbursed, updateFamilyExpense,
} from "@/server/expenses";
import { monthKeyOf, todayISO } from "@/lib/months";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 0, language: "ar", reminderEmail: null });
});

const exp = (amount: number, category: "home" | "car" | "groceries" | "other", date: string, note: string | null = null) =>
  addFamilyExpense(db, { amount, category, date, note });

describe("family expenses", () => {
  it("assigns each expense to the month of its date", async () => {
    await exp(5000, "car", "2026-03-31");
    await exp(2000, "home", "2026-04-01");
    const mar = (await findMonth(db, "2026-03"))!;
    const apr = (await findMonth(db, "2026-04"))!;
    expect((await monthClaim(db, mar.id)).total).toBe(5000);
    expect((await monthClaim(db, apr.id)).total).toBe(2000);
  });

  it("totals and breaks down by category", async () => {
    await exp(8000, "car", "2026-03-02");
    await exp(2000, "car", "2026-03-05");
    await exp(5000, "home", "2026-03-06");
    const m = (await findMonth(db, "2026-03"))!;
    const c = await monthClaim(db, m.id);
    expect(c.total).toBe(15000);
    expect(c.count).toBe(3);
    expect(c.breakdown[0]).toEqual({ category: "car", total: 10000 });
  });

  it("edits and deletes, keeping totals right", async () => {
    const id = await exp(1000, "home", "2026-03-02", "soap");
    await updateFamilyExpense(db, id, { amount: 1500, category: "groceries", date: "2026-03-03", note: null });
    const m = (await findMonth(db, "2026-03"))!;
    expect((await monthClaim(db, m.id)).total).toBe(1500);
    expect((await getFamilyExpense(db, id))?.category).toBe("groceries");
    await deleteFamilyExpense(db, id);
    expect(await listFamilyExpenses(db, m.id)).toHaveLength(0);
    await expect(deleteFamilyExpense(db, id)).rejects.toMatchObject({ code: "notFound" });
  });

  it("moves an expense to another month when its date changes", async () => {
    const id = await exp(1000, "home", "2026-03-30");
    await updateFamilyExpense(db, id, { amount: 1000, category: "home", date: "2026-04-02", note: null });
    expect((await getFamilyExpense(db, id))?.monthKey).toBe("2026-04");
  });

  it("rejects non-positive amounts", async () => {
    await expect(exp(0, "home", "2026-03-02")).rejects.toMatchObject({ code: "amountPositive" });
  });
});

describe("reimbursement", () => {
  it("marks the month reimbursed with the exact total, then blocks new expenses", async () => {
    await exp(43000, "home", "2026-03-02");
    expect(await markReimbursed(db, "2026-03")).toBe(43000);
    const m = (await findMonth(db, "2026-03"))!;
    expect(m).toMatchObject({ reimbursed: true, reimbursedAmount: 43000 });
    await expect(exp(100, "home", "2026-03-20")).rejects.toThrow(/month_reimbursed/);
    await expect(markReimbursed(db, "2026-03")).rejects.toMatchObject({ code: "alreadyDone" });
  });

  it("can be undone while open, and a zero claim can be reimbursed", async () => {
    await getOrCreateMonth(db, "2026-03");
    expect(await markReimbursed(db, "2026-03")).toBe(0);
    await undoReimbursed(db, "2026-03");
    expect((await findMonth(db, "2026-03"))!.reimbursed).toBe(false);
    await exp(100, "home", "2026-03-20");
  });

  it("rejects when the total changed since the confirmation screen", async () => {
    await exp(1000, "home", "2026-03-02");
    await expect(markReimbursed(db, "2026-03", 999)).rejects.toMatchObject({ code: "alreadyDone" });
  });
});

describe("Saudi time", () => {
  it("uses Riyadh for today and for month keys", () => {
    // 22:30 UTC on 30 Apr is already 1 May in Riyadh
    const d = new Date("2026-04-30T22:30:00Z");
    expect(todayISO(d)).toBe("2026-05-01");
    expect(monthKeyOf(d)).toBe("2026-05");
  });
});
