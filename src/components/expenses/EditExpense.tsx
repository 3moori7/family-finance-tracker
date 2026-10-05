"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import type { ActionResult } from "@/server/errors";
import { ExpenseForm, type ExpenseDefaults } from "./ExpenseForm";

export function EditExpense({
  defaults,
  maxDate,
  backHref,
  updateAction,
  deleteAction,
}: {
  defaults: ExpenseDefaults & { id: number };
  maxDate: string;
  backHref: string;
  updateAction: (prev: ActionResult | undefined, fd: FormData) => Promise<ActionResult>;
  deleteAction: (id: number) => Promise<ActionResult>;
}) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      <ExpenseForm
        action={updateAction}
        defaults={defaults}
        maxDate={maxDate}
        submitLabel={t("save")}
        onSuccess={() => {
          toast.show(t("updated"));
          router.push(backHref);
        }}
      />
      {!confirming ? (
        <Button type="button" variant="secondary" className="text-danger" onClick={() => setConfirming(true)} full>
          {t("delete")}
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl bg-danger-soft p-3">
          <p className="text-sm font-medium text-danger">{t("deleteConfirm")}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="danger"
              disabled={pending}
              className="flex-1"
              onClick={() =>
                start(async () => {
                  const res = await deleteAction(defaults.id);
                  if (res.ok) {
                    toast.show(t("deleted"));
                    router.push(backHref);
                  } else toast.show(te(res.error), { kind: "error" });
                })
              }
            >
              {t("delete")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setConfirming(false)}>
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
