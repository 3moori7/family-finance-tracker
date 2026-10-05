"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import type { Category } from "@/lib/categories";
import type { ActionResult } from "@/server/errors";
import { CategoryPicker } from "./CategoryPicker";

export interface ExpenseDefaults {
  id?: number;
  amount?: string;
  category?: Category;
  date: string;
  note?: string;
}

type Action<T extends object> = (prev: ActionResult<T> | undefined, fd: FormData) => Promise<ActionResult<T>>;

/** Shared by the quick-add sheet and the edit page. */
export function ExpenseForm<T extends object>({
  action,
  defaults,
  maxDate,
  autoFocus,
  onSuccess,
  submitLabel,
  extra,
  resetOnSuccess,
}: {
  action: Action<T>;
  defaults: ExpenseDefaults;
  maxDate: string;
  autoFocus?: boolean;
  onSuccess?: (result: ActionResult<T> & { ok: true }) => void;
  submitLabel: string;
  extra?: React.ReactNode;
  resetOnSuccess?: boolean;
}) {
  const t = useTranslations("expenses");
  const ref = useRef<HTMLFormElement>(null);
  // a dropped connection must show an error, never look like a silent save
  const guarded: Action<T> = async (prev, fd) => {
    try {
      return await action(prev, fd);
    } catch {
      return { ok: false, error: "network" };
    }
  };
  const [state, formAction, pending] = useActionState<ActionResult<T> | undefined, FormData>(guarded, undefined);
  const err = useFieldError(state);
  const handled = useRef<unknown>(null);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      if (resetOnSuccess) {
        ref.current?.reset();
        ref.current?.querySelector<HTMLInputElement>("input[name=amount]")?.focus();
      }
      onSuccess?.(state);
    }
  }, [state, onSuccess, resetOnSuccess]);

  return (
    <form ref={ref} action={formAction} className="flex flex-col gap-4">
      {defaults.id !== undefined && <input type="hidden" name="id" value={defaults.id} />}
      <Field label={t("amount")} error={err("amount")}>
        <AmountInput defaultValue={defaults.amount} autoFocus={autoFocus} />
      </Field>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("category")}</span>
        <CategoryPicker defaultValue={defaults.category} />
        {err("category") && <span className="text-xs text-danger">{err("category")}</span>}
      </div>
      <Field label={t("date")} error={err("date")}>
        <TextInput type="date" name="date" defaultValue={defaults.date} max={maxDate} required dir="ltr" />
      </Field>
      <Field label={`${t("note")}`} error={err("note")}>
        <TextInput name="note" defaultValue={defaults.note} maxLength={200} />
      </Field>
      {extra}
      <FormError error={state && !state.ok && !state.field ? state.error : undefined} />
      <Button type="submit" disabled={pending} full>
        {submitLabel}
      </Button>
    </form>
  );
}
