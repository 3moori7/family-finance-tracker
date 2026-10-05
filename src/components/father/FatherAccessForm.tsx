"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, TextInput } from "@/components/ui/Field";
import { FormError, useFieldError } from "@/components/ui/FormError";
import type { ActionResult } from "@/server/errors";

type LinkResult = ActionResult<{ link?: string }>;

export function FatherAccessForm({
  configured,
  enableAction,
  rotateAction,
  pinAction,
}: {
  configured: boolean;
  enableAction: (p: LinkResult | undefined, fd: FormData) => Promise<LinkResult>;
  rotateAction: (p: LinkResult | undefined) => Promise<LinkResult>;
  pinAction: (p: LinkResult | undefined, fd: FormData) => Promise<LinkResult>;
}) {
  const t = useTranslations("father");
  const [enable, enableForm, enablePending] = useActionState<LinkResult | undefined, FormData>(enableAction, undefined);
  const [rotate, rotateForm, rotatePending] = useActionState<LinkResult | undefined>(rotateAction, undefined);
  const [pinS, pinForm, pinPending] = useActionState<LinkResult | undefined, FormData>(pinAction, undefined);
  const eErr = useFieldError(enable);
  const pErr = useFieldError(pinS);
  const [copied, setCopied] = useState(false);

  const link = (enable?.ok && enable.link) || (rotate?.ok && rotate.link) || undefined;

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-center justify-between">
        <span className="text-sm text-ink-soft">{t("status")}</span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${configured ? "bg-ok-soft text-ok" : "bg-surface-2 text-ink-soft"}`}
        >
          {configured ? t("configured") : t("notConfigured")}
        </span>
      </Card>

      {link && (
        <Card className="flex flex-col gap-3 border-gold/40 bg-gold-soft/50">
          <h2 className="font-semibold">{t("linkTitle")}</h2>
          <p className="text-sm">{t("linkOnce")}</p>
          <input readOnly value={link} dir="ltr" onFocus={(e) => e.currentTarget.select()} className="min-h-12 rounded-xl border border-line bg-surface px-3 text-sm" />
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                /* the field is selectable, so copying by hand still works */
              }
            }}
          >
            {copied ? t("copied") : t("copy")}
          </Button>
          <p className="text-xs text-ink-soft">{t("tellPin")}</p>
        </Card>
      )}

      {!configured && (
        <Card>
          <form action={enableForm} className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">{t("intro")}</p>
            <Field label={t("pin")} error={eErr("pin")}>
              <TextInput name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" required dir="ltr" autoComplete="off" />
            </Field>
            <FormError error={enable && !enable.ok && !enable.field ? enable.error : undefined} />
            <Button type="submit" disabled={enablePending} full>
              {t("create")}
            </Button>
          </form>
        </Card>
      )}

      {configured && (
        <>
          <Card>
            <form action={pinForm} className="flex flex-col gap-3">
              <Field label={t("pin")} error={pErr("pin")}>
                <TextInput name="pin" type="password" inputMode="numeric" pattern="[0-9]{4,8}" required dir="ltr" autoComplete="off" />
              </Field>
              <FormError error={pinS && !pinS.ok && !pinS.field ? pinS.error : undefined} />
              {pinS?.ok && <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{t("pinSaved")}</p>}
              <Button type="submit" variant="secondary" disabled={pinPending} full>
                {t("changePin")}
              </Button>
            </form>
          </Card>
          <Card>
            <form action={rotateForm} className="flex flex-col gap-3">
              <p className="text-sm text-ink-soft">{t("newLinkHint")}</p>
              <FormError error={rotate && !rotate.ok ? rotate.error : undefined} />
              <Button type="submit" variant="secondary" disabled={rotatePending} full>
                {t("newLink")}
              </Button>
            </form>
          </Card>
        </>
      )}
    </div>
  );
}
