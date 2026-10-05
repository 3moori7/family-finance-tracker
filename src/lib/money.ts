/** All money is stored as integer halalas (1 SAR = 100 halalas). */
export type Halalas = number;

export function sarToHalalas(sar: number | string): Halalas {
  const n = typeof sar === "string" ? Number(sar.replace(/[,\s]/g, "")) : sar;
  if (!Number.isFinite(n)) throw new Error("Invalid amount");
  return Math.round(n * 100);
}

export function halalasToSar(h: Halalas): number {
  return h / 100;
}

/** Parse user input like "12.5", "١٢٫٥" or "1,200" into halalas. Returns null if invalid. */
export function parseAmountInput(input: string): Halalas | null {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const normalized = input
    .trim()
    .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
    .replace(/[٫]/g, ".")
    .replace(/[٬,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return sarToHalalas(normalized);
}

export function formatSar(h: Halalas, locale: "ar" | "en" = "en"): string {
  const sign = h < 0 ? "-" : "";
  const abs = Math.abs(h);
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = abs % 100;
  const num = cents === 0 ? whole : `${whole}.${cents.toString().padStart(2, "0")}`;
  // In Arabic the number is wrapped in a left-to-right isolate so a minus sign stays in front of it
  // ("-50") instead of jumping behind it ("50-") in right-to-left text.
  return locale === "ar" ? `\u2066${sign}${num}\u2069 ر.س` : `${sign}${num} SAR`;
}

/** Plain decimal string for form inputs (no currency, no grouping). */
export function toInputString(h: Halalas): string {
  const abs = Math.abs(h);
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const s = cents === 0 ? `${whole}` : `${whole}.${cents.toString().padStart(2, "0")}`;
  return h < 0 ? `-${s}` : s;
}

/** Like parseAmountInput but accepts a leading minus (used for salary adjustments and corrections). */
export function parseSignedAmountInput(input: string): Halalas | null {
  const trimmed = input.trim().replace(/^[−–]/, "-");
  if (trimmed.startsWith("-")) {
    const v = parseAmountInput(trimmed.slice(1));
    return v === null ? null : -v;
  }
  return parseAmountInput(trimmed.startsWith("+") ? trimmed.slice(1) : trimmed);
}
