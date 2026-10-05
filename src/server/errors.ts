import { ZodError } from "zod";

export const ERROR_CODES = [
  "required",
  "amountInvalid",
  "amountPositive",
  "amountZero",
  "percentInvalid",
  "emailInvalid",
  "dateInvalid",
  "categoryInvalid",
  "pinInvalid",
  "noteRequired",
  "month_closed",
  "month_reimbursed",
  "date_month_mismatch",
  "insufficient_balance",
  "deposit_exists",
  "deposit_missing",
  "salary_not_confirmed",
  "close_incomplete",
  "ledger_append_only",
  "month_delete_forbidden",
  "alreadyDone",
  "notFound",
  "locked",
  "invalidPin",
  "forbidden",
  "network",
  "unknown",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

/** Expected failure with a user-facing, translatable code. */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public field?: string,
  ) {
    super(code);
  }
}

export type ActionResult<T extends object = object> =
  | ({ ok: true } & T)
  | { ok: false; error: ErrorCode; field?: string };

/** Database rules raise exceptions whose message is one of our codes. */
export function toErrorCode(e: unknown): { code: ErrorCode; field?: string } {
  if (e instanceof AppError) return { code: e.code, field: e.field };
  if (e instanceof ZodError) {
    const issue = e.issues[0];
    return { code: "required", field: String(issue?.path?.[0] ?? "") || undefined };
  }
  const msg = e instanceof Error ? e.message : String(e);
  const hit = ERROR_CODES.find((c) => msg.includes(c) && c !== "unknown" && c !== "required");
  if (hit) return { code: hit };
  console.error("Unexpected error:", e);
  return { code: "unknown" };
}

/** Run a service call and turn any failure into an ActionResult. */
export async function run<T extends object = object>(fn: () => Promise<T | void>): Promise<ActionResult<T>> {
  try {
    const r = await fn();
    return { ok: true, ...((r ?? {}) as T) };
  } catch (e) {
    // Next.js redirects/not-found are thrown as special errors and must pass through.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw e;
    }
    const { code, field } = toErrorCode(e);
    return { ok: false, error: code, field };
  }
}
