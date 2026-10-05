"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";

export function CloseCard({
  month,
  canClose,
  closed,
  action,
}: {
  month: string;
  canClose: boolean;
  closed: boolean;
  action: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
}) {
  const t = useTranslations("close");
  const [confirming, setConfirming] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t("title")}</h2>
        {closed && <span className="rounded-full bg-ok-soft px-2.5 py-0.5 text-xs font-medium text-ok">{t("done")}</span>}
      </div>
      {!closed && (
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="month" value={month} />
          <p className="text-xs text-ink-soft">{canClose ? t("hint") : t("missing")}</p>
          <FormError error={state && !state.ok ? state.error : undefined} />
          {!confirming ? (
            <Button type="button" disabled={!canClose} onClick={() => setConfirming(true)} full>
              {t("submit")}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button type="submit" disabled={pending} className="flex-1">
                {t("confirm")}
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
