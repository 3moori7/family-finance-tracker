"use client";

import { useTranslations } from "next-intl";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-lg font-semibold">{t("unknown")}</p>
      <button onClick={reset} className="min-h-12 rounded-xl bg-primary px-6 font-semibold text-primary-ink">
        ↻
      </button>
    </main>
  );
}
