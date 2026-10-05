import { parseAmountInput, parseSignedAmountInput, type Halalas } from "@/lib/money";
import { isCategory, type Category } from "@/lib/categories";
import { AppError } from "./errors";

export function str(v: FormDataEntryValue | null | undefined): string {
  return typeof v === "string" ? v.trim() : "";
}

export function requiredText(v: FormDataEntryValue | null | undefined, field: string, max = 300): string {
  const s = str(v);
  if (!s) throw new AppError("required", field);
  return s.slice(0, max);
}

export function optionalText(v: FormDataEntryValue | null | undefined, max = 300): string | null {
  const s = str(v);
  return s ? s.slice(0, max) : null;
}

export function money(
  v: FormDataEntryValue | null | undefined,
  field: string,
  opts: { allowZero?: boolean; signed?: boolean } = {},
): Halalas {
  const raw = str(v);
  if (!raw) throw new AppError("required", field);
  const parsed = opts.signed ? parseSignedAmountInput(raw) : parseAmountInput(raw);
  if (parsed === null) throw new AppError("amountInvalid", field);
  if (!opts.signed && parsed === 0 && !opts.allowZero) throw new AppError("amountPositive", field);
  if (parsed > 100_000_000_00) throw new AppError("amountInvalid", field); // 100M SAR sanity cap
  return parsed;
}

export function isoDate(v: FormDataEntryValue | null | undefined, field = "date"): string {
  const s = str(v);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError("dateInvalid", field);
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new AppError("dateInvalid", field);
  return s;
}

export function category(v: FormDataEntryValue | null | undefined): Category {
  const s = str(v);
  if (!isCategory(s)) throw new AppError("categoryInvalid", "category");
  return s;
}

export function percent(v: FormDataEntryValue | null | undefined, field: string): number {
  const s = str(v).replace("٫", ".");
  const n = Number(s);
  if (!s || !Number.isFinite(n) || n < 0 || n > 100) throw new AppError("percentInvalid", field);
  return Math.round(n * 100) / 100;
}

export function emailOrNull(v: FormDataEntryValue | null | undefined, field = "reminderEmail"): string | null {
  const s = str(v);
  if (!s) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw new AppError("emailInvalid", field);
  return s.toLowerCase();
}
