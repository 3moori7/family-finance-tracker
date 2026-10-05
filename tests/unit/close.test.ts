import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { findMonth, getOrCreateMonth, saveSalary, setSadaqahGiven } from "@/server/months";
import { addWithdrawal, confirmDeposit, getBalance } from "@/server/ledger";
import { addFamilyExpense, markReimbursed } from "@/server/expenses";
import { acceptDifference, correctToCount, countStatus, latestCount, submitCashCount } from "@/server/cashcount";
import { buildChecklist, closeMonth } from "@/server/checklist";

let db: Db;
const KEY = "2026-03";
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
});

async function doAllExceptCount() {
  await saveSalary(db, KEY, { adjustment: 0, note: null });
  await confirmDeposit(db, KEY, "2026-03-28");
  await setSadaqahGiven(db, KEY, true);
  await addFamilyExpense(db, { amount: 43000, category: "home", date: "2026-03-05", note: null });
  await markReimbursed(db, KEY);
}

describe("cash count", () => {
  it("matches the app's balance", async () => {
    await getOrCreateMonth(db, KEY);
    const r = await submitCashCount(db, KEY, 2500000);
    expect(r).toMatchObject({ matches: true, difference: 0 });
  });

  it("flags a shortage and resolves it with a logged correction, not by editing history", async () => {
    const m = await getOrCreateMonth(db, KEY);
    const r = await submitCashCount(db, KEY, 2499000);
    expect(r).toMatchObject({ kind: "shortage", difference: -1000 });
    expect(countStatus(await latestCount(db, m.id), await getBalance(db))).toBe("mismatch");
    await correctToCount(db, KEY, "Dad lent 10 SAR to the neighbour");
    expect(await getBalance(db)).toBe(2499000);
    expect(countStatus(await latestCount(db, m.id), await getBalance(db))).toBe("match");
    const log = await db.query<{ n: number }>("select count(*)::int n from activity_log where entity='ledger_entries' and action='create'");
    expect(log[0].n).toBe(2); // opening + correction
  });

  it("handles a surplus", async () => {
    await getOrCreateMonth(db, KEY);
    await submitCashCount(db, KEY, 2500500);
    await correctToCount(db, KEY, "found extra cash");
    expect(await getBalance(db)).toBe(2500500);
  });

  it("can accept an explained difference, but only with a note", async () => {
    const m = await getOrCreateMonth(db, KEY);
    await submitCashCount(db, KEY, 2400000);
    await expect(acceptDifference(db, KEY, "")).rejects.toMatchObject({ code: "noteRequired" });
    await acceptDifference(db, KEY, "withdrawn earlier, entry forgotten");
    expect(countStatus(await latestCount(db, m.id), await getBalance(db))).toBe("accepted");
  });

  it("becomes stale when the balance changes after the count", async () => {
    const m = await getOrCreateMonth(db, KEY);
    await submitCashCount(db, KEY, 2500000);
    await addWithdrawal(db, { amount: 100, reason: "x", date: "2026-03-10" });
    expect(countStatus(await latestCount(db, m.id), await getBalance(db))).toBe("stale");
  });
});

describe("month close", () => {
  it("lists what is missing and refuses to close", async () => {
    const m = await getOrCreateMonth(db, KEY);
    const list = await buildChecklist(db, m);
    expect(list.canClose).toBe(false);
    expect(list.steps.filter((s) => !s.done).map((s) => s.key)).toEqual(["salary", "deposit", "sadaqah", "cashcount"]);
    await expect(closeMonth(db, KEY)).rejects.toMatchObject({ code: "close_incomplete" });
  });

  it("closes only when every step is done, then locks", async () => {
    await doAllExceptCount();
    await submitCashCount(db, KEY, 2500000 + 725000);
    const m = (await findMonth(db, KEY))!;
    expect((await buildChecklist(db, m)).canClose).toBe(true);
    await closeMonth(db, KEY);
    const closed = (await findMonth(db, KEY))!;
    expect(closed.status).toBe("closed");
    expect(closed.closedAt).not.toBeNull();
    await expect(addFamilyExpense(db, { amount: 1, category: "home", date: "2026-03-20", note: null })).rejects.toThrow(/month_closed/);
    await expect(closeMonth(db, KEY)).rejects.toMatchObject({ code: "alreadyDone" });
  });

  it("a zero-expense month needs no reimbursement", async () => {
    await saveSalary(db, KEY, { adjustment: 0, note: null });
    await confirmDeposit(db, KEY, "2026-03-28");
    await setSadaqahGiven(db, KEY, true);
    await submitCashCount(db, KEY, 3225000);
    await closeMonth(db, KEY);
    expect((await findMonth(db, KEY))!.status).toBe("closed");
  });

  it("the database refuses to close with an unresolved mismatch or a stale count", async () => {
    await doAllExceptCount();
    await submitCashCount(db, KEY, 3200000); // short
    const m = (await findMonth(db, KEY))!;
    await expect(db.query("update months set status='closed' where id=$1", [m.id])).rejects.toThrow(/close_incomplete/);
    await correctToCount(db, KEY, "miscount");
    await addWithdrawal(db, { amount: 100, reason: "x", date: "2026-04-01" }); // balance moved after the count
    await expect(db.query("update months set status='closed' where id=$1", [m.id])).rejects.toThrow(/close_incomplete/);
    await submitCashCount(db, KEY, 3200000 - 100);
    await closeMonth(db, KEY);
  });

  it("allows corrections but nothing else after closing", async () => {
    await doAllExceptCount();
    await submitCashCount(db, KEY, 3225000);
    await closeMonth(db, KEY);
    await db.query(
      "insert into ledger_entries(month_id, type, amount, reason) select id,'correction',-100,'late fix' from months where year_month=$1",
      [KEY],
    );
    expect(await getBalance(db)).toBe(3225000 - 100);
  });
});
