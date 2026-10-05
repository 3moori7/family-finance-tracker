import { getTranslations } from "next-intl/server";
import { ActivityView } from "@/components/activity/ActivityView";
import { requireOwner } from "@/server/session";

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ m?: string; type?: string; page?: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("activity");
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <ActivityView audience="owner" basePath="/more/activity" params={await searchParams} />
    </>
  );
}
