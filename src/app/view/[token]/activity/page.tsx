import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { ActivityView } from "@/components/activity/ActivityView";
import { PinForm } from "@/components/father/PinForm";
import { sessionStillValid, verifyViewToken } from "@/server/father";
import { getFatherSession } from "@/server/session";

export default async function FatherActivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ m?: string; type?: string; page?: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  if (!(await verifyViewToken(db, token))) notFound();
  const session = await getFatherSession();
  if (!session || !(await sessionStillValid(db, session.v))) return <PinForm token={token} />;
  const t = await getTranslations("activity");
  return (
    <>
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t("title")}</h2>
        <Link href={`/view/${token}`} className="min-h-11 content-center text-sm font-medium text-primary">
          ‹
        </Link>
      </div>
      <ActivityView audience="father" basePath={`/view/${token}/activity`} params={await searchParams} />
    </>
  );
}
