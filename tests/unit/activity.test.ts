import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { findMonth, getOrCreateMonth, saveSalary, setSadaqahGiven } from "@/server/months";
import { addFamilyExpense, markReimbursed, updateFamilyExpense } from "@/server/expenses";
import { addWithdrawal } from "@/server/ledger";
import { addPersonalExpense } from "@/server/personal";
import { submitCashCount } from "@/server/cashcount";
import { listActivity } from "@/server/activity";
import { describeActivity } from "@/lib/activity";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
});

const t = (key: string, v?: Record<string, string | number>) => (v ? `${key}:${JSON.stringify(v)}` : key);
const tc = (c: string) => `cat:${c}`;

describe("activity log listing", () => {
  it("lists newest first and filters by entity", async () => {
    const id = await addFamilyExpense(db, { amount: 4500, category: "car", date: "2026-03-02", note: "fuel" });
    await updateFamilyExpense(db, id, { amount: 5000, category: "car", date: "2026-03-02", note: "fuel" });
    const all = await listActivity(db, { audience: "owner" });
    expect(all.rows[0].entity).toBe("family_expenses");
    expect(all.rows[0].action).toBe("edit");
    const only = await listActivity(db, { audience: "owner", entity: "family_expenses" });
    expect(only.rows.map((r) => r.action)).toEqual(["edit", "create"]);
  });

  it("paginates", async () => {
    for (let i = 0; i < 5; i++) await addPersonalExpense(db, { amount: 100 + i, category: "other", date: "2026-03-02", note: null });
    const first = await listActivity(db, { audience: "owner", entity: "personal_expenses", limit: 2 });
    expect(first.rows).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const last = await listActivity(db, { audience: "owner", entity: "personal_expenses", limit: 2, offset: 4 });
    expect(last.rows).toHaveLength(1);
    expect(last.hasMore).toBe(false);
  });

  it("filters by month of the change (Riyadh time)", async () => {
    await addPersonalExpense(db, { amount: 1, category: "other", date: "2026-03-02", note: null });
    const thisMonth = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" }).slice(0, 7);
    expect((await listActivity(db, { audience: "owner", monthKey: thisMonth })).rows.length).toBeGreaterThan(0);
    expect((await listActivity(db, { audience: "owner", monthKey: "2001-01" })).rows).toHaveLength(0);
  });
});

describe("what the father can read in the log", () => {
  it("excludes itemised expenses, personal spending, settings and salary figures", async () => {
    await addFamilyExpense(db, { amount: 8000, category: "car", date: "2026-03-02", note: "ITEM-SECRET" });
    await addPersonalExpense(db, { amount: 12345, category: "other", date: "2026-03-02", note: "PRIVATE-SECRET" });
    await getOrCreateMonth(db, "2026-03");
    await saveSalary(db, "2026-03", { adjustment: 777700, note: "SALARY-SECRET" });
    await setSadaqahGiven(db, "2026-03", true);
    await markReimbursed(db, "2026-03");
    await addWithdrawal(db, { amount: 500, reason: "Car repair", date: "2026-03-10" });
    await submitCashCount(db, "2026-03", 2499500);

    const { rows } = await listActivity(db, { audience: "father", limit: 100 });
    const json = JSON.stringify(rows);
    for (const secret of ["ITEM-SECRET", "PRIVATE-SECRET", "SALARY-SECRET", "7777", "salary_base", "reminder_email", "family_expenses", "personal_expenses", "settings"]) {
      expect(json).not.toContain(secret);
    }
    const entities = new Set(rows.map((r) => r.entity));
    expect([...entities].every((e) => ["ledger_entries", "cash_counts", "months"].includes(e))).toBe(true);
    expect(json).toContain("Car repair"); // savings movements are visible to the person holding the cash
    const monthRows = rows.filter((r) => r.entity === "months");
    expect(monthRows.length).toBe(2); // sadaqah given + reimbursed only
    for (const r of monthRows) expect(Object.keys(r.newValue ?? {}).every((k) => ["status", "reimbursed", "reimbursed_amount", "sadaqah_given", "year_month"].includes(k))).toBe(true);
    void findMonth;
  });
});

describe("describeActivity", () => {
  it("describes edits with before and after amounts", () => {
    const d = describeActivity(
      { entity: "family_expenses", action: "edit", oldValue: { amount: 4500, category: "car" }, newValue: { amount: 5000, category: "car", note: "fuel" } },
      t, "en", tc,
    );
    expect(d.title).toBe("entity.family_expenses · action.edit");
    expect(d.detail).toBe("45 SAR → 50 SAR · cat:car · fuel");
  });
  it("describes ledger movements with the reason", () => {
    const d = describeActivity(
      { entity: "ledger_entries", action: "create", oldValue: null, newValue: { type: "withdrawal", amount: 50000, reason: "Emergency" } },
      t, "en", tc,
    );
    expect(d.detail).toBe("ledger.withdrawal 500 SAR · Emergency");
  });
});
