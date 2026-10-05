import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { Card } from "@/components/ui/Card";
import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/session";

export default async function ExportPage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("export");
  const s = await getSettings(await getDb());
  const btn = "flex min-h-12 items-center justify-center rounded-xl px-4 font-semibold";
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("sheet")}</h2>
        <p className="text-sm text-ink-soft">{t("sheetHint")}</p>
        <a href="/api/export" download className={`${btn} bg-primary text-primary-ink`}>
          {t("downloadSheet")}
        </a>
      </Card>
      <Card className="flex flex-col gap-3">
        <h2 className="font-semibold">{t("backup")}</h2>
        <p className="text-sm text-ink-soft">{t("backupHint")}</p>
        <a href="/api/export?format=json" download className={`${btn} border border-line bg-surface`}>
          {t("downloadBackup")}
        </a>
      </Card>
      <Card className="flex flex-col gap-1">
        <h2 className="font-semibold">{t("weekly")}</h2>
        <p className="text-sm text-ink-soft">
          {s?.reminderEmail ? t("weeklyOn", { email: s.reminderEmail }) : t("weeklyOff")}
        </p>
      </Card>
    </>
  );
}
