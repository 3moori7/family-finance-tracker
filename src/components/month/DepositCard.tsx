"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";

export function DepositCard({
  month,
  amount,
  salaryConfirmed,
  deposited,
  closed,
  action,
}: {
  month: string;
  amount: number;
  salaryConfirmed: boolean;
  deposited: boolean;
  closed: boolean;
  action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}) {
  const t = useTranslations("deposit");
  const locale = useLocale() as "ar" | "en";
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        {deposited && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">{t("done")}</span>}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
        <span className="text-sm text-ink-soft">{t("amount")}</span>
        <Amount value={amount} locale={locale} className="text-lg font-semibold" />
      </div>
      <p className="text-xs text-ink-soft">{t("hint")}</p>
      {!deposited && !closed && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <FormError error={state && !state.ok ? state.error : undefined} />
          <Button type="submit" disabled={pending || !salaryConfirmed} full>
            {salaryConfirmed ? t("confirm") : t("needSalary")}
          </Button>
        </form>
      )}
    </Card>
  );
}
