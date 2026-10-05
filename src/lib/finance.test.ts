import { describe, expect, it } from "vitest";
import { calculateSplit } from "./split";
import { formatSar, parseAmountInput, sarToHalalas, toInputString } from "./money";
import { categoryBreakdown, familyClaim, personalLeft, savingsBalance } from "./balances";
import { compareCount } from "./cashcount";
import { isMonthKey, monthKeyOf, shiftMonth } from "./months";

describe("calculateSplit", () => {
  it("matches the PRD example: 10,000 SAR", () => {
    const s = calculateSplit(sarToHalalas(10000));
    expect(s.fatherShare).toBe(750000);
    expect(s.sadaqah).toBe(25000);
    expect(s.savingsDeposit).toBe(725000);
    expect(s.ownerKeeps).toBe(250000);
  });

  it("parts always sum to the salary, even for odd amounts", () => {
    for (const salary of [1, 3, 7, 99, 12345, 999999, 1234567, 333333]) {
      const s = calculateSplit(salary);
      expect(s.savingsDeposit + s.sadaqah + s.ownerKeeps).toBe(salary);
      expect(s.savingsDeposit).toBeGreaterThanOrEqual(0);
    }
  });

  it("handles zero salary and rejects bad input", () => {
    expect(calculateSplit(0).fatherShare).toBe(0);
    expect(() => calculateSplit(-1)).toThrow();
    expect(() => calculateSplit(10.5)).toThrow();
    expect(() => calculateSplit(100, 150)).toThrow();
    expect(() => calculateSplit(100, 75, 80)).toThrow();
  });

  it("supports custom percentages", () => {
    const s = calculateSplit(100000, 50, 5);
    expect(s.fatherShare).toBe(50000);
    expect(s.sadaqah).toBe(5000);
    expect(s.ownerKeeps).toBe(50000);
  });
});

describe("money helpers", () => {
  it("parses amounts including Arabic digits", () => {
    expect(parseAmountInput("12.5")).toBe(1250);
    expect(parseAmountInput("١٢٫٥")).toBe(1250);
    expect(parseAmountInput("1,200")).toBe(120000);
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("1.234")).toBeNull();
    expect(parseAmountInput("-5")).toBeNull();
  });
  it("formats", () => {
    expect(formatSar(123456)).toBe("1,234.56 SAR");
    expect(formatSar(100000, "ar")).toBe("\u20661,000\u2069 ر.س");
    expect(formatSar(-5000, "ar")).toBe("\u2066-50\u2069 ر.س");
    expect(formatSar(-250)).toBe("-2.50 SAR");
    expect(toInputString(1250)).toBe("12.50");
    expect(toInputString(1000)).toBe("10");
  });
});

describe("balances", () => {
  it("computes the savings balance from ledger entries", () => {
    const bal = savingsBalance([
      { type: "opening", amount: 100000 },
      { type: "deposit", amount: 72500 },
      { type: "withdrawal", amount: 20000 },
      { type: "correction", amount: -500 },
    ]);
    expect(bal).toBe(152000);
  });
  it("computes claims and breakdown", () => {
    const ex = [
      { amount: 8000, category: "car" as const },
      { amount: 5000, category: "home" as const },
      { amount: 2000, category: "car" as const },
    ];
    expect(familyClaim(ex)).toBe(15000);
    expect(categoryBreakdown(ex)).toEqual([
      { category: "car", total: 10000 },
      { category: "home", total: 5000 },
    ]);
  });
  it("estimates personal money left (can go negative)", () => {
    expect(personalLeft(250000, [{ amount: 100000 }])).toBe(150000);
    expect(personalLeft(1000, [{ amount: 2000 }])).toBe(-1000);
  });
});

describe("cash count", () => {
  it("detects match, shortage, surplus", () => {
    expect(compareCount(1000, 1000).kind).toBe("match");
    expect(compareCount(900, 1000)).toMatchObject({ kind: "shortage", difference: -100 });
    expect(compareCount(1100, 1000)).toMatchObject({ kind: "surplus", difference: 100 });
  });
});

describe("months", () => {
  it("shifts across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthKeyOf("2026-03-15")).toBe("2026-03");
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-02")).toBe(true);
  });
});
