"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput, AmountInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import { parseSignedAmountInput } from "@/lib/money";
import { calculateSplit } from "@/lib/split";
import type { ActionResult } from "@/server/errors";

interface Props {
  month: string;
  base: number;
  adjustment: number;
  note: string | null;
  splitPercent: number;
  sadaqahPercent: number;
  confirmed: boolean;
  /** true once the deposit is confirmed or the month is closed */
  locked: boolean;
  action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}

export function SalaryCard(p: Props) {
  const t = useTranslations("salary");
  const locale = useLocale() as "ar" | "en";
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(p.action, undefined);
  const err = useFieldError(state);
  const [adjText, setAdjText] = useState(p.adjustment === 0 ? "" : String(p.adjustment / 100));
  const adj = adjText.trim() === "" ? 0 : (parseSignedAmountInput(adjText) ?? p.adjustment);
  const split = calculateSplit(Math.max(0, p.base + adj), p.splitPercent, p.sadaqahPercent);

  const row = (label: string, value: number, strong = false) => (
    <div className={`flex items-center justify-between py-1.5 ${strong ? "font-semibold" : "text-ink-soft"}`}>
      <span>{label}</span>
      <Amount value={value} locale={locale} />
    </div>
  );

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        {p.confirmed && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">{t("confirmed")}</span>}
      </div>
      <div className="rounded-xl bg-surface-2 px-3 py-1 text-sm">
        {row(t("base"), p.base)}
        {adj !== 0 && row(t("adjustment"), adj)}
        {row(t("adjusted"), split.salary, true)}
        <hr className="my-1 border-line" />
        {row(t("toFather"), split.fatherShare, true)}
        <div className="ps-4 text-xs">
          {row(t("savings"), split.savingsDeposit)}
          {row(t("sadaqah"), split.sadaqah)}
        </div>
        {row(t("keep"), split.ownerKeeps, true)}
      </div>

      {p.locked ? (
        <p className="text-xs text-ink-soft">{t("locked")}</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={p.month} />
          <Field label={t("adjustment")} hint={t("adjustmentHint")} error={err("adjustment")}>
            <AmountInput
              name="adjustment"
              allowNegative
              required={false}
              defaultValue={adjText}
              onValueChange={setAdjText}
            />
          </Field>
          {adj !== 0 && (
            <Field label={t("note")} error={err("note")}>
              <TextInput name="note" defaultValue={p.note ?? ""} />
            </Field>
          )}
          <FormError error={state && !state.ok && !state.field ? state.error : undefined} />
          <Button type="submit" disabled={pending} full>
            {p.confirmed ? t("update") : t("confirm")}
          </Button>
        </form>
      )}
    </Card>
  );
}
