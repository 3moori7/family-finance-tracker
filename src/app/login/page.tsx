import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";
import { getOwnerSession } from "@/server/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getOwnerSession()) redirect("/");
  const t = await getTranslations("login");
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t("subtitle")}</p>
        </div>
        <LanguageToggle />
      </div>
      <LoginForm />
    </main>
  );
}
