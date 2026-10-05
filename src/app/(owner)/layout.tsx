import { redirect } from "next/navigation";
import { getDb } from "@/db/client";
import { AppShell } from "@/components/ui/AppShell";
import { getSettings } from "@/server/settings";
import { requireOwner } from "@/server/session";

export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  const settings = await getSettings(await getDb());
  if (!settings?.setupCompleted) redirect("/setup");
  return <AppShell>{children}</AppShell>;
}
