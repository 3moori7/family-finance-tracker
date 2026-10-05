"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/app/actions/locale";

export function LanguageToggle({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("common");
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => setLocale(locale === "ar" ? "en" : "ar"))}
      className={`min-h-11 rounded-lg border border-line bg-surface px-3 text-sm font-medium text-ink ${className}`}
    >
      {t("language")}
    </button>
  );
}
