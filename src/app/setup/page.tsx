import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/session";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  await requireOwner();
  const settings = await getSettings(await getDb());
  if (settings?.setupCompleted) redirect("/");
  const t = await getTranslations("setup");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 p-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("intro")}</p>
        </div>
        <LanguageToggle />
      </div>
      <SetupForm />
    </main>
  );
}
