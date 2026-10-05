"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";

export function SadaqahCard({
  month,
  amount,
  given,
  closed,
  action,
}: {
  month: string;
  amount: number;
  given: boolean;
  closed: boolean;
  action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}) {
  const t = useTranslations("sadaqah");
  const locale = useLocale() as "ar" | "en";
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        {given && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">{t("given")}</span>}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
        <span className="text-sm text-ink-soft">{t("amount")}</span>
        <Amount value={amount} locale={locale} className="text-lg font-semibold" />
      </div>
      <p className="text-xs text-ink-soft">{t("hint")}</p>
      {!closed && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="given" value={given ? "0" : "1"} />
          <FormError error={state && !state.ok ? state.error : undefined} />
          <Button type="submit" variant={given ? "secondary" : "primary"} disabled={pending} full>
            {given ? t("undo") : t("markGiven")}
          </Button>
        </form>
      )}
    </Card>
  );
}
