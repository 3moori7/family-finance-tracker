import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { Amount } from "@/components/ui/Amount";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { getOrCreateMonth, monthSplit, neighbours, resolveMonthKey } from "@/server/months";
import { personalSummary } from "@/server/personal";
import { requireOwner } from "@/server/session";

export default async function PersonalPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const db = await getDb();
  const t = await getTranslations("personal");
  const tc = await getTranslations("categories");
  const locale = (await getLocale()) as "ar" | "en";
  const { m } = await searchParams;
  const key = await resolveMonthKey(db, m);
  const month = await getOrCreateMonth(db, key);
  const { prevKey, nextKey } = await neighbours(db, key);
  const summary = await personalSummary(db, key, monthSplit(month).ownerKeeps);
  const max = Math.max(1, ...summary.breakdown.map((b) => b.total));

  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      <p className="-mt-2 text-sm text-ink-soft">
        {t("optional")} · {t("private")}
      </p>
      <MonthSwitcher monthKey={key} basePath="/personal" prevKey={prevKey} nextKey={nextKey} />
      <Card>
        <CardTitle>{t("estimatedLeft")}</CardTitle>
        <Amount
          value={summary.left}
          locale={locale}
          className={`mt-1 block text-3xl font-bold ${summary.left < 0 ? "text-danger" : "text-primary"}`}
        />
        <p className="mt-1 text-xs text-ink-soft">{t("estimateHint")}</p>
        <div className="mt-3 flex justify-between text-sm text-ink-soft">
          <span>{t("ownerShare")}</span>
          <Amount value={monthSplit(month).ownerKeeps} locale={locale} />
        </div>
        <div className="flex justify-between text-sm text-ink-soft">
          <span>{t("spent")}</span>
          <Amount value={summary.total} locale={locale} />
        </div>
      </Card>
      {summary.breakdown.length > 0 && (
        <Card>
          <CardTitle>{t("breakdown")}</CardTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {summary.breakdown.map((b) => (
              <li key={b.category} className="text-sm">
                <div className="flex justify-between">
                  <span>{tc(b.category)}</span>
                  <Amount value={b.total} locale={locale} />
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-surface-2">
                  <div className="h-1.5 rounded-full bg-gold" style={{ width: `${(b.total / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <h2 className="text-sm font-medium text-ink-soft">{t("list")}</h2>
      {summary.list.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {summary.list.map((e) => (
            <li key={e.id}>
              <Link
                href={`/personal/${e.id}`}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5 active:bg-surface-2"
              >
                <div className="min-w-0">
                  <span className="rounded-full bg-gold-soft px-2 py-0.5 text-xs font-medium text-gold">{tc(e.category)}</span>
                  <p className="mt-1 truncate text-xs text-ink-soft">
                    <span className="num">{e.date}</span>
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <Amount value={e.amount} locale={locale} className="font-semibold" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
