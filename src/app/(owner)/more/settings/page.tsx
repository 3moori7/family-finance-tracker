import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { toInputString } from "@/lib/money";
import { requireSettings } from "@/server/settings";
import { SettingsForm } from "./SettingsForm";
import { requireOwner } from "@/server/session";

export default async function SettingsPage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("settings");
  const s = await requireSettings(await getDb());
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <SettingsForm
        values={{
          salary: toInputString(s.salaryAmount),
          splitPercent: String(s.splitPercent),
          sadaqahPercent: String(s.sadaqahPercent),
          language: s.language,
          reminderEmail: s.reminderEmail ?? "",
          remindersEnabled: s.remindersEnabled,
        }}
      />
    </>
  );
}
