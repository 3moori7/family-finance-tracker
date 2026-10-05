"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import { formatSar } from "@/lib/money";
import type { ActionResult } from "@/server/errors";

type Action = (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;

export function ReimburseCard({
  month,
  total,
  reimbursed,
  reimbursedAmount,
  closed,
  reimburseAction,
  undoAction,
}: {
  month: string;
  total: number;
  reimbursed: boolean;
  reimbursedAmount: number | null;
  closed: boolean;
  reimburseAction: Action;
  undoAction: Action;
}) {
  const t = useTranslations("expenses");
  const locale = useLocale() as "ar" | "en";
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(reimburseAction, undefined);
  const [undoState, undoFormAction, undoPending] = useActionState<ActionResult | undefined, FormData>(undoAction, undefined);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("reimburse")}</h2>
        {reimbursed && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">{t("settled")}</span>}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
        <span className="text-sm text-ink-soft">{reimbursed ? t("reimbursedOn") : t("claimAmount")}</span>
        <Amount value={reimbursed ? (reimbursedAmount ?? total) : total} locale={locale} className="text-lg font-semibold" />
      </div>
      {reimbursed ? (
        !closed && (
          <form action={undoFormAction}>
            <input type="hidden" name="month" value={month} />
            <FormError error={undoState && !undoState.ok ? undoState.error : undefined} />
            <Button type="submit" variant="ghost" disabled={undoPending} full>
              {t("undoReimbursed")}
            </Button>
          </form>
        )
      ) : closed ? null : total === 0 ? (
        <form action={formAction} className="flex flex-col gap-3">
          <p className="text-sm text-ink-soft">{t("noClaim")}</p>
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="expected" value={total} />
          <FormError error={state && !state.ok ? state.error : undefined} />
          <Button type="submit" variant="secondary" disabled={pending} full>
            {t("markReimbursed")}
          </Button>
        </form>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <input type="hidden" name="expected" value={total} />
          <FormError error={state && !state.ok ? state.error : undefined} />
          {!confirming ? (
            <Button type="button" onClick={() => setConfirming(true)} full>
              {t("markReimbursed")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                {t("markConfirm", { amount: formatSar(total, locale) })}
              </Button>
              <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
                ✕
              </Button>
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
