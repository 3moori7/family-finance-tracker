"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, Select, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";
import { submitSetup } from "./actions";

export function SetupForm() {
  const t = useTranslations("setup");
  const locale = useLocale();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(submitSetup, undefined);
  const err = useFieldError(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("salary")} hint={t("salaryHint")} error={err("salary")}>
        <AmountInput name="salary" />
      </Field>
      <Field label={t("opening")} hint={t("openingHint")} error={err("opening")}>
        <AmountInput name="opening" />
      </Field>
      <Field label={t("email")} hint={t("emailHint")} error={err("email")}>
        <TextInput name="email" type="email" dir="ltr" autoComplete="email" />
      </Field>
      <Field label={t("language")}>
        <Select name="language" defaultValue={locale}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <FormError error={state && !state.ok && !state.field ? state.error : undefined} />
      <Button type="submit" disabled={pending} full>
        {t("submit")}
      </Button>
    </form>
  );
}
