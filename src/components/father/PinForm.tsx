"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { submitPin, type PinState } from "@/app/view/[token]/actions";

export function PinForm({ token }: { token: string }) {
  const t = useTranslations("view");
  const te = useTranslations("errors");
  const [state, action, pending] = useActionState<PinState, FormData>(submitPin.bind(null, token), {});
  return (
    <Card className="mt-6 flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-bold">{t("pinTitle")}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t("pinHint")}</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4,8}"
          autoComplete="one-time-code"
          autoFocus
          required
          dir="ltr"
          aria-label={t("pinLabel")}
          className="num min-h-16 rounded-xl border border-line bg-surface px-4 text-center text-3xl tracking-[0.4em]"
        />
        {state.error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {state.error === "locked" ? te("locked") : t("wrongPin")}
          </p>
        )}
        <Button type="submit" disabled={pending} full className="min-h-14 text-lg">
          {t("open")}
        </Button>
      </form>
    </Card>
  );
}
