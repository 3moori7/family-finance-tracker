"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AmountInput, Field, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/server/errors";

export function WithdrawForm({
  action,
}: {
  action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}) {
  const t = useTranslations("savings");
  const toast = useToast();
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  const err = useFieldError(state);
  useEffect(() => {
    if (state?.ok) {
      toast.show(t("saved"));
      ref.current?.reset();
    }
  }, [state, toast, t]);
  return (
    <Card>
      <details>
        <summary className="flex min-h-11 cursor-pointer items-center font-semibold">{t("withdraw")}</summary>
        <form ref={ref} action={formAction} className="mt-3 flex flex-col gap-3">
          <Field label={t("withdrawAmount")} error={err("amount")}>
            <AmountInput />
          </Field>
          <Field label={t("withdrawReason")} hint={t("withdrawHint")} error={err("reason")}>
            <TextInput name="reason" required maxLength={200} />
          </Field>
          <FormError error={state && !state.ok && !state.field ? state.error : undefined} />
          <Button type="submit" variant="secondary" disabled={pending} full>
            {t("withdrawSubmit")}
          </Button>
        </form>
      </details>
    </Card>
  );
}
