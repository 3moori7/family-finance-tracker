import { getTranslations } from "next-intl/server";
import { LanguageToggle } from "../LanguageToggle";
import { BottomNav } from "./BottomNav";
import { ToastProvider } from "./Toast";
import { QuickAdd } from "../expenses/QuickAdd";
import { todayISO } from "@/lib/months";

/** Mobile-first frame for owner screens. */
export async function AppShell({ children }: { children: React.ReactNode }) {
  const t = await getTranslations("app");
  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
        <header className="no-print flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-lg font-bold text-primary">{t("short")}</span>
          <LanguageToggle />
        </header>
        <main className="flex flex-1 flex-col gap-4 px-4 pb-28 pt-2">{children}</main>
        <QuickAdd today={todayISO()} />
        <BottomNav />
      </div>
    </ToastProvider>
  );
}
