"use client";

import { useTranslations } from "next-intl";
import type { ErrorCode } from "@/server/errors";

/** Shows a translated error banner for a failed server action. */
export function FormError({ error }: { error?: ErrorCode }) {
  const t = useTranslations("errors");
  if (!error) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
      {t(error)}
    </p>
  );
}

/** Per-field error text (used inside <Field error=...>). */
export function useFieldError(state: { ok: boolean; error?: ErrorCode; field?: string } | undefined) {
  const t = useTranslations("errors");
  return (field: string) =>
    state && !state.ok && state.field === field && state.error ? t(state.error) : undefined;
}
