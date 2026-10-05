"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Amount } from "@/components/ui/Amount";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AmountInput, Field, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import { formatSar } from "@/lib/money";
import type { CountStatus } from "@/server/cashcount";
import type { ActionResult } from "@/server/errors";

type Action = (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;

function useAction(action: Action) {
  return useActionState<ActionResult | undefined, FormData>(action, undefined);
}

export function CashCountCard({
  month,
  status,
  last,
  expected,
  closed,
  countAction,
  correctAction,
  acceptAction,
}: {
  month: string;
  status: CountStatus;
  last: { counted: number; expected: number; difference: number; note: string | null } | null;
  expected: number;
  closed: boolean;
  countAction: Action;
  correctAction: Action;
  acceptAction: Action;
}) {
  const t = useTranslations("cashcount");
  const locale = useLocale() as "ar" | "en";
  const [countState, countForm, countPending] = useAction(countAction);
  const [fixState, fixForm, fixPending] = useAction(correctAction);
  const [acceptState, acceptForm, acceptPending] = useAction(acceptAction);
  const cErr = useFieldError(countState);
  const fErr = useFieldError(fixState);
  const aErr = useFieldError(acceptState);

  const ok = status === "match" || status === "accepted";
  const badge =
    status === "match" || status === "accepted" ? (
      <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">
        {status === "match" ? t("match") : t("accepted")}
      </span>
    ) : status === "mismatch" ? (
      <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-medium text-danger">
        {last && last.difference < 0
          ? t("shortage", { amount: formatSar(-last.difference, locale) })
          : t("surplus", { amount: formatSar(last?.difference ?? 0, locale) })}
      </span>
    ) : status === "stale" ? (
      <span className="rounded-full bg-gold-soft px-2.5 py-0.5 text-xs font-medium text-gold">{t("stale")}</span>
    ) : null;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t("title")}</h2>
        {badge}
      </div>
      <div className="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-2">
        <span className="text-sm text-ink-soft">{t("expected")}</span>
        <Amount value={expected} locale={locale} className="text-lg font-semibold" />
      </div>
      {last && (
        <div className="flex items-center justify-between text-sm text-ink-soft">
          <span>{t("history")}</span>
          <Amount value={last.counted} locale={locale} />
        </div>
      )}
      {last?.note && <p className="text-xs text-ink-soft">{last.note}</p>}

      {!closed && (status === "none" || status === "stale") && (
        <form action={countForm} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <Field label={t("counted")} hint={t("intro")} error={cErr("counted")}>
            <AmountInput name="counted" />
          </Field>
          <FormError error={countState && !countState.ok && !countState.field ? countState.error : undefined} />
          <Button type="submit" disabled={countPending} full>
            {t("submit")}
          </Button>
        </form>
      )}

      {!closed && status === "mismatch" && (
        <div className="flex flex-col gap-4">
          <form action={fixForm} className="flex flex-col gap-3 rounded-xl border border-line p-3">
            <input type="hidden" name="month" value={month} />
            <h3 className="text-sm font-semibold">{t("correctTitle")}</h3>
            <Field label={t("correctReason")} hint={t("correctHint")} error={fErr("reason")}>
              <TextInput name="reason" required maxLength={200} />
            </Field>
            <FormError error={fixState && !fixState.ok && !fixState.field ? fixState.error : undefined} />
            <Button type="submit" disabled={fixPending} full>
              {t("correctSubmit")}
            </Button>
          </form>
          <form action={acceptForm} className="flex flex-col gap-3 rounded-xl border border-line p-3">
            <input type="hidden" name="month" value={month} />
            <h3 className="text-sm font-semibold">{t("acceptTitle")}</h3>
            <Field label={t("acceptNote")} error={aErr("note")}>
              <TextInput name="note" required maxLength={200} />
            </Field>
            <FormError error={acceptState && !acceptState.ok && !acceptState.field ? acceptState.error : undefined} />
            <Button type="submit" variant="secondary" disabled={acceptPending} full>
              {t("acceptSubmit")}
            </Button>
          </form>
        </div>
      )}

      {!closed && ok && (
        <form action={countForm} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <details>
            <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary">{t("recount")}</summary>
            <div className="mt-2 flex flex-col gap-3">
              <AmountInput name="counted" />
              <Button type="submit" variant="secondary" disabled={countPending} full>
                {t("submit")}
              </Button>
            </div>
          </details>
        </form>
      )}
    </Card>
  );
}
