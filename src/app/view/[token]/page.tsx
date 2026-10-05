import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { PinForm } from "@/components/father/PinForm";
import { HomeCards } from "@/components/home/HomeCards";
import { Amount } from "@/components/ui/Amount";
import { Card, CardTitle } from "@/components/ui/Card";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { isMonthKey } from "@/lib/months";
import { monthLabel } from "@/lib/month-label";
import { getFatherView, sessionStillValid, verifyViewToken } from "@/server/father";
import { getFatherSession } from "@/server/session";
import { exitView } from "./actions";

export default async function ViewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ m?: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  // an unknown or rotated link looks like any other missing page
  if (!(await verifyViewToken(db, token))) notFound();

  const session = await getFatherSession();
  if (!session || !(await sessionStillValid(db, session.v))) return <PinForm token={token} />;

  const { m } = await searchParams;
  const view = await getFatherView(db, m && isMonthKey(m) ? m : undefined);
  const t = await getTranslations("view");
  const tc = await getTranslations("categories");
  const tn = await getTranslations("home");
  const ta = await getTranslations("activity");
  const locale = (await getLocale()) as "ar" | "en";
  const max = Math.max(1, ...view.breakdown.map((b) => b.total));
  const countTone =
    view.cashCount === "match" || view.cashCount === "accepted"
      ? "bg-ok-soft text-ok"
      : view.cashCount === "none"
        ? "bg-surface-2 text-ink-soft"
        : "bg-gold-soft text-gold";

  return (
    <>
      <MonthSwitcher monthKey={view.monthKey} basePath={`/view/${token}`} prevKey={view.prevKey} nextKey={view.nextKey} />
      <HomeCards
        readOnly
        balance={view.balance}
        claimTotal={view.claimTotal}
        claimCount={view.claimCount}
        reimbursed={view.reimbursed}
        locale={locale}
        labels={{
          savings: tn("savings"),
          claim: t("claim"),
          claimMonth: monthLabel(view.monthKey, locale),
          statusToClaim: tn("statusToClaim"),
          statusSettled: tn("statusSettled"),
          nothing: tn("nothing"),
        }}
      />
      {view.breakdown.length > 0 && (
        <Card>
          <CardTitle>{t("breakdown")}</CardTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {view.breakdown.map((b) => (
              <li key={b.category} className="text-sm">
                <div className="flex justify-between">
                  <span>{tc(b.category)}</span>
                  <Amount value={b.total} locale={locale} />
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(b.total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">{t("cashCount")}</span>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${countTone}`}>{t(`count.${view.cashCount}`)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-soft">{t("sadaqah")}</span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${view.sadaqahGiven ? "bg-ok-soft text-ok" : "bg-gold-soft text-gold"}`}
          >
            {view.sadaqahGiven ? t("sadaqahGiven") : t("sadaqahPending")}
          </span>
        </div>
      </Card>
      <Link
        href={`/view/${token}/activity`}
        className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface px-4 text-sm font-medium"
      >
        {ta("viewLog")}
        <span className="text-ink-soft">›</span>
      </Link>
      <form action={exitView.bind(null, token)}>
        <button className="min-h-12 w-full rounded-xl border border-line bg-surface text-sm font-medium text-ink-soft">
          {t("exit")}
        </button>
      </form>
    </>
  );
}
