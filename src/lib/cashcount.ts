import type { Halalas } from "./money";

export interface CashCountResult {
  counted: Halalas;
  expected: Halalas;
  /** counted - expected: negative is a shortage, positive is a surplus. */
  difference: Halalas;
  matches: boolean;
  kind: "match" | "shortage" | "surplus";
}

export function compareCount(counted: Halalas, expected: Halalas): CashCountResult {
  const difference = counted - expected;
  return {
    counted,
    expected,
    difference,
    matches: difference === 0,
    kind: difference === 0 ? "match" : difference < 0 ? "shortage" : "surplus",
  };
}
