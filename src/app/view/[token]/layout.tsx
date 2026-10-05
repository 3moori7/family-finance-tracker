import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "@/components/LanguageToggle";

export default async function ViewLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("view");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-4">
      <header className="flex items-center justify-between pb-4">
        <h1 className="text-lg font-bold text-primary">{t("title")}</h1>
        <LanguageToggle />
      </header>
      <main className="flex flex-1 flex-col gap-4">{children}</main>
    </div>
  );
}
