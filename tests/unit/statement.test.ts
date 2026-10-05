import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { saveSalary, setSadaqahGiven } from "@/server/months";
import { addWithdrawal, confirmDeposit, getBalance } from "@/server/ledger";
import { addFamilyExpense, markReimbursed } from "@/server/expenses";
import { submitCashCount } from "@/server/cashcount";
import { closeMonth } from "@/server/checklist";
import { buildStatement, listStatementMonths } from "@/server/statement";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
});

async function runMonth(key: string, adjustment = 0) {
  await saveSalary(db, key, { adjustment, note: adjustment ? "adj" : null });
  await confirmDeposit(db, key, `${key}-28`);
  await setSadaqahGiven(db, key, true);
}

describe("monthly statement", () => {
  it("reconciles with the underlying data for a closed month", async () => {
    await runMonth("2026-03", 50000);
    await addFamilyExpense(db, { amount: 8000, category: "car", date: "2026-03-02", note: null });
    await addFamilyExpense(db, { amount: 5000, category: "home", date: "2026-03-09", note: "soap" });
    await addWithdrawal(db, { amount: 100000, reason: "Emergency", date: "2026-03-12" });
    await markReimbursed(db, "2026-03");
    await submitCashCount(db, "2026-03", await getBalance(db));
    await closeMonth(db, "2026-03");

    const s = (await buildStatement(db, "2026-03"))!;
    expect(s.month.status).toBe("closed");
    expect(s.salary).toMatchObject({ base: 1000000, adjustment: 50000, adjusted: 1050000 });
    expect(s.split).toMatchObject({ fatherShare: 787500, sadaqah: 26250, savingsDeposit: 761250, ownerKeeps: 262500 });
    expect(s.savings.deposits).toBe(761250);
    expect(s.savings.withdrawals).toBe(100000);
    expect(s.savings.opening).toBe(2500000);
    expect(s.savings.closing).toBe(2500000 + 761250 - 100000);
    expect(s.savings.closing).toBe(await getBalance(db));
    // opening + deposits - withdrawals + corrections = closing, always
    expect(s.savings.opening + s.savings.deposits - s.savings.withdrawals + s.savings.corrections).toBe(s.savings.closing);
    expect(s.family).toMatchObject({ total: 13000, count: 2 });
    expect(s.family.items.map((i) => i.amount).sort()).toEqual([5000, 8000]);
    expect(s.reimbursed).toMatchObject({ done: true, amount: 13000 });
    expect(s.sadaqahGiven).toBe(true);
    expect(s.cashCount).toMatchObject({ counted: s.savings.closing, difference: 0 });
  });

  it("chains opening balances across months", async () => {
    await runMonth("2026-03");
    await runMonth("2026-04");
    const mar = (await buildStatement(db, "2026-03"))!;
    const apr = (await buildStatement(db, "2026-04"))!;
    expect(apr.savings.opening).toBe(mar.savings.closing);
    expect(apr.savings.closing).toBe(mar.savings.closing + apr.savings.deposits);
  });

  it("returns null for an unknown month and lists months newest first", async () => {
    expect(await buildStatement(db, "2020-01")).toBeNull();
    await runMonth("2026-03");
    await runMonth("2026-04");
    expect((await listStatementMonths(db)).map((m) => m.key)).toEqual(["2026-04", "2026-03"]);
  });
});
