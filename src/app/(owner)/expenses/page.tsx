import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { ReimburseCard } from "@/components/expenses/ReimburseCard";
import { Amount } from "@/components/ui/Amount";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { listFamilyExpenses, monthClaim } from "@/server/expenses";
import { getOrCreateMonth, neighbours, resolveMonthKey } from "@/server/months";
import { reimburseAction, undoReimburseAction } from "./actions";
import { requireOwner } from "@/server/session";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const db = await getDb();
  const t = await getTranslations("expenses");
  const tc = await getTranslations("categories");
  const locale = (await getLocale()) as "ar" | "en";
  const { m } = await searchParams;
  const key = await resolveMonthKey(db, m);
  const month = await getOrCreateMonth(db, key);
  const { prevKey, nextKey } = await neighbours(db, key);
  const [list, claim] = await Promise.all([listFamilyExpenses(db, month.id), monthClaim(db, month.id)]);
  const locked = month.status === "closed" || month.reimbursed;
  const max = Math.max(1, ...claim.breakdown.map((b) => b.total));

  return (
    <>
      <MonthSwitcher monthKey={key} basePath="/expenses" prevKey={prevKey} nextKey={nextKey} />
      <Card>
        <div className="flex items-start justify-between">
          <CardTitle>{t("claimTitle")}</CardTitle>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${month.reimbursed ? "bg-ok-soft text-ok" : "bg-gold-soft text-gold"}`}
          >
            {month.reimbursed ? t("settled") : t("toClaim")}
          </span>
        </div>
        <Amount value={claim.total} locale={locale} className="mt-1 block text-3xl font-bold text-primary" />
        <p className="text-xs text-ink-soft">{t("count", { count: claim.count })}</p>
        {claim.breakdown.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2">
            {claim.breakdown.map((b) => (
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
        )}
      </Card>

      <ReimburseCard
        month={key}
        total={claim.total}
        reimbursed={month.reimbursed}
        reimbursedAmount={month.reimbursedAmount}
        closed={month.status === "closed"}
        reimburseAction={reimburseAction}
        undoAction={undoReimburseAction}
      />
      {locked && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">{t("lockedReimbursed")}</p>}

      <h2 className="text-sm font-medium text-ink-soft">{t("list")}</h2>
      {list.length === 0 ? (
        <EmptyState title={t("empty")} hint={t("emptyHint")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((e) => {
            const body = (
              <>
                <div className="min-w-0">
                  <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary">{tc(e.category)}</span>
                  <p className="mt-1 truncate text-xs text-ink-soft">
                    <span className="num">{e.date}</span>
                    {e.note ? ` · ${e.note}` : ""}
                  </p>
                </div>
                <Amount value={e.amount} locale={locale} className="font-semibold" />
              </>
            );
            const cls = "flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5";
            return (
              <li key={e.id}>
                {locked ? (
                  <div className={cls}>{body}</div>
                ) : (
                  <Link href={`/expenses/${e.id}`} className={`${cls} active:bg-surface-2`}>
                    {body}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
