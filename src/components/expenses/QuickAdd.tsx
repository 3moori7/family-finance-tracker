"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/Toast";
import { addExpenseAction, deleteExpenseAction } from "@/app/(owner)/expenses/actions";
import { addPersonalAction, deletePersonalAction } from "@/app/(owner)/personal/actions";
import { ExpenseForm } from "./ExpenseForm";

/** Floating "+" button and bottom sheet for adding a family expense in a few taps. */
export function QuickAdd({ today }: { today: string }) {
  const t = useTranslations("expenses");
  const te = useTranslations("errors");
  const tp = useTranslations("personal");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"family" | "personal">("family");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const onSuccess = useCallback(
    (r: { id: number }) => {
      toast.show(t("saved"), {
        action: {
          label: t("undo"),
          run: async () => {
            const res = await (kind === "family" ? deleteExpenseAction(r.id) : deletePersonalAction(r.id));
            if (!res.ok) toast.show(te(res.error), { kind: "error" });
          },
        },
      });
    },
    [toast, t, te, kind],
  );

  return (
    <>
      <div className="no-print pointer-events-none fixed inset-x-0 bottom-20 z-30">
        <div className="mx-auto flex max-w-md justify-end px-4">
          <button
            type="button"
            aria-label={t("openAdd")}
            onClick={() => setOpen(true)}
            className="pointer-events-auto flex size-14 items-center justify-center rounded-full bg-primary text-3xl leading-none text-primary-ink shadow-lg"
          >
            +
          </button>
        </div>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("add")}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-bg p-4 pb-8"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-bold">{t("add")}</h2>
              <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-lg px-3 font-medium text-primary">
                {t("done")}
              </button>
            </div>
            <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
              {(["family", "personal"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={kind === k}
                  onClick={() => setKind(k)}
                  className={`min-h-11 rounded-lg text-sm font-semibold ${kind === k ? "bg-surface shadow-sm" : "text-ink-soft"}`}
                >
                  {k === "family" ? tp("kindFamily") : tp("kindPersonal")}
                </button>
              ))}
            </div>
            <ExpenseForm
              key={kind}
              action={kind === "family" ? addExpenseAction : addPersonalAction}
              defaults={{ date: today }}
              maxDate={today}
              autoFocus
              resetOnSuccess
              onSuccess={onSuccess}
              submitLabel={t("save")}
            />
          </div>
        </div>
      )}
    </>
  );
}
