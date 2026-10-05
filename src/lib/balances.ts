import type { Halalas } from "./money";

export type LedgerType = "opening" | "deposit" | "withdrawal" | "correction";

export interface LedgerEntryLike {
  type: LedgerType;
  /** Always a positive number for deposit/withdrawal/opening; corrections are signed. */
  amount: Halalas;
}

/** Signed effect of one ledger entry on the savings pot. */
export function ledgerEffect(e: LedgerEntryLike): Halalas {
  return e.type === "withdrawal" ? -e.amount : e.amount;
}

export function savingsBalance(entries: LedgerEntryLike[]): Halalas {
  return entries.reduce((sum, e) => sum + ledgerEffect(e), 0);
}

export function familyClaim(expenses: { amount: Halalas }[]): Halalas {
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

export function categoryBreakdown<T extends string>(
  expenses: { amount: Halalas; category: T }[],
): { category: T; total: Halalas }[] {
  const map = new Map<T, Halalas>();
  for (const e of expenses) map.set(e.category, (map.get(e.category) ?? 0) + e.amount);
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

/** Estimate only: the owner's 25% minus whatever they chose to log. Can be negative. */
export function personalLeft(ownerKeeps: Halalas, personalExpenses: { amount: Halalas }[]): Halalas {
  return ownerKeeps - personalExpenses.reduce((s, e) => s + e.amount, 0);
}
