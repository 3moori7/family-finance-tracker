// Demo data for trying the app: a signed-in-able owner, a closed month and an open one with some spending.
// Stop `npm run dev` first when using the embedded database (it can only be opened by one process).
import { getDb } from "../src/db/client";
import { todayISO, shiftMonth, monthKeyOf } from "../src/lib/months";
import { addFamilyExpense, markReimbursed } from "../src/server/expenses";
import { closeMonth } from "../src/server/checklist";
import { submitCashCount } from "../src/server/cashcount";
import { addWithdrawal, confirmDeposit, getBalance } from "../src/server/ledger";
import { saveSalary, setSadaqahGiven } from "../src/server/months";
import { upsertOwner } from "../src/server/owner";
import { addPersonalExpense } from "../src/server/personal";
import { completeSetup, getSettings } from "../src/server/settings";

async function main() {
  const db = await getDb();
  if ((await getSettings(db))?.setupCompleted) throw new Error("This database already has data; refusing to seed it.");
  await upsertOwner(db, "owner@example.com", "demo-password");
  await completeSetup(db, { salaryAmount: 1_000_000, openingBalance: 2_500_000, language: "ar", reminderEmail: null });

  const thisMonth = monthKeyOf(new Date());
  const lastMonth = shiftMonth(thisMonth, -1);
  // last month: complete and closed
  await saveSalary(db, lastMonth, { adjustment: 0, note: null });
  await confirmDeposit(db, lastMonth, `${lastMonth}-27`);
  await setSadaqahGiven(db, lastMonth, true);
  await addFamilyExpense(db, { amount: 8_000, category: "car", date: `${lastMonth}-05`, note: "Fuel" });
  await addFamilyExpense(db, { amount: 12_500, category: "home", date: `${lastMonth}-11`, note: "Cleaning supplies" });
  await addFamilyExpense(db, { amount: 21_000, category: "groceries", date: `${lastMonth}-19`, note: null });
  await markReimbursed(db, lastMonth);
  await addWithdrawal(db, { amount: 100_000, reason: "Car repair", date: `${lastMonth}-15` });
  await submitCashCount(db, lastMonth, await getBalance(db));
  await closeMonth(db, lastMonth);
  // this month: in progress
  const today = todayISO();
  await addFamilyExpense(db, { amount: 7_500, category: "car", date: today, note: "Fuel" });
  await addPersonalExpense(db, { amount: 3_000, category: "other", date: today, note: "Coffee" });
  console.log(`Seeded. Sign in with owner@example.com / demo-password (balance ${(await getBalance(db)) / 100} SAR).`);
  await db.close();
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
