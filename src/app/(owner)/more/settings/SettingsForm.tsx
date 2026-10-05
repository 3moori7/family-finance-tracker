"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, Select, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";
import { saveSettings } from "./actions";

export interface SettingsFormValues {
  salary: string;
  splitPercent: string;
  sadaqahPercent: string;
  language: "ar" | "en";
  reminderEmail: string;
  remindersEnabled: boolean;
}

export function SettingsForm({ values }: { values: SettingsFormValues }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(saveSettings, undefined);
  const err = useFieldError(state);
  return (
    <form action={action} className="flex flex-col gap-4">
      <Field label={t("salary")} error={err("salary")}>
        <AmountInput name="salary" defaultValue={values.salary} />
      </Field>
      <Field label={t("split")} error={err("splitPercent")}>
        <TextInput name="splitPercent" inputMode="decimal" dir="ltr" defaultValue={values.splitPercent} required />
      </Field>
      <Field label={t("sadaqah")} hint={t("sadaqahHint")} error={err("sadaqahPercent")}>
        <TextInput name="sadaqahPercent" inputMode="decimal" dir="ltr" defaultValue={values.sadaqahPercent} required />
      </Field>
      <Field label={t("language")}>
        <Select name="language" defaultValue={values.language}>
          <option value="ar">العربية</option>
          <option value="en">English</option>
        </Select>
      </Field>
      <Field label={t("email")} error={err("reminderEmail")}>
        <TextInput name="reminderEmail" type="email" dir="ltr" defaultValue={values.reminderEmail} />
      </Field>
      <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
        <input type="checkbox" name="remindersEnabled" defaultChecked={values.remindersEnabled} className="size-5 accent-primary" />
        {t("reminders")}
      </label>
      <FormError error={state && !state.ok && !state.field ? state.error : undefined} />
      {state?.ok && <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{t("saved")}</p>}
      <Button type="submit" disabled={pending} full>
        {tc("save")}
      </Button>
    </form>
  );
}
