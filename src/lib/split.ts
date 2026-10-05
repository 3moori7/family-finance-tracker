import type { Halalas } from "./money";

export const DEFAULT_SPLIT_PERCENT = 75;
export const DEFAULT_SADAQAH_PERCENT = 2.5;

export interface Split {
  salary: Halalas;
  /** Total handed to Dad (savings deposit + sadaqah). */
  fatherShare: Halalas;
  /** Sadaqah, included within fatherShare. */
  sadaqah: Halalas;
  /** What actually goes into the savings pot. */
  savingsDeposit: Halalas;
  /** What the owner keeps. */
  ownerKeeps: Halalas;
}

/**
 * Rounding rule: fatherShare = round(salary * split%), sadaqah = round(salary * sadaqah%),
 * savingsDeposit = fatherShare - sadaqah, ownerKeeps = salary - fatherShare.
 * The parts therefore always sum to the salary.
 */
export function calculateSplit(
  salary: Halalas,
  splitPercent: number = DEFAULT_SPLIT_PERCENT,
  sadaqahPercent: number = DEFAULT_SADAQAH_PERCENT,
): Split {
  if (!Number.isInteger(salary)) throw new Error("Salary must be integer halalas");
  if (salary < 0) throw new Error("Salary cannot be negative");
  if (splitPercent < 0 || splitPercent > 100) throw new Error("Invalid split percent");
  if (sadaqahPercent < 0 || sadaqahPercent > splitPercent) throw new Error("Invalid sadaqah percent");
  // Work in basis points (percent * 100) to avoid float drift: 2.5% -> 250.
  const splitBp = Math.round(splitPercent * 100);
  const sadaqahBp = Math.round(sadaqahPercent * 100);
  const fatherShare = Math.round((salary * splitBp) / 10000);
  const sadaqah = Math.min(Math.round((salary * sadaqahBp) / 10000), fatherShare);
  return {
    salary,
    fatherShare,
    sadaqah,
    savingsDeposit: fatherShare - sadaqah,
    ownerKeeps: salary - fatherShare,
  };
}
