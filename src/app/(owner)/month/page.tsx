import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { monthLabel } from "@/lib/month-label";
import { DepositCard } from "@/components/month/DepositCard";
import { SadaqahCard } from "@/components/month/SadaqahCard";
import { SalaryCard } from "@/components/month/SalaryCard";
import { MonthSwitcher } from "@/components/ui/MonthSwitcher";
import { CashCountCard } from "@/components/month/CashCountCard";
import { ChecklistCard } from "@/components/month/Checklist";
import { CloseCard } from "@/components/month/CloseCard";
import { ReimburseCard } from "@/components/expenses/ReimburseCard";
import { latestCount } from "@/server/cashcount";
import { buildChecklist } from "@/server/checklist";
import { getBalance, hasDeposit } from "@/server/ledger";
import { reimburseAction, undoReimburseAction } from "../expenses/actions";
import { getOrCreateMonth, monthSplit, neighbours, resolveMonthKey, staleOpenMonths } from "@/server/months";
import { requireOwner } from "@/server/session";
import {
  acceptCountAction, cashCountAction, closeMonthAction, confirmDepositAction, correctCountAction,
  sadaqahAction, saveSalaryAction,
} from "./actions";

export default async function MonthPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const db = await getDb();
  const t = await getTranslations("month");
  const locale = (await getLocale()) as "ar" | "en";
  const { m } = await searchParams;
  const key = await resolveMonthKey(db, m);
  const month = await getOrCreateMonth(db, key);
  const { prevKey, nextKey } = await neighbours(db, key);
  const stale = (await staleOpenMonths(db)).filter((k) => k !== key);
  const deposited = await hasDeposit(db, month.id);
  const split = monthSplit(month);
  const closed = month.status === "closed";
  const checklist = await buildChecklist(db, month);
  const [last, balance] = await Promise.all([latestCount(db, month.id), getBalance(db)]);

  return (
    <>
      <MonthSwitcher monthKey={key} basePath="/month" prevKey={prevKey} nextKey={nextKey} />
      <div className="flex items-center justify-center">
        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${closed ? "bg-surface-2 text-ink-soft" : "bg-gold-soft text-gold"}`}
        >
          {closed ? t("closed") : t("open")}
        </span>
      </div>
      {stale.length > 0 && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
          {t("staleWarning", { months: stale.map((k) => monthLabel(k, locale)).join("، ") })}
        </p>
      )}
      {closed && <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-soft">{t("readonlyClosed")}</p>}

      <ChecklistCard list={checklist} closed={closed} />

      <SalaryCard
        month={key}
        base={month.salaryBase}
        adjustment={month.salaryAdjustment}
        note={month.adjustmentNote}
        splitPercent={month.splitPercent}
        sadaqahPercent={month.sadaqahPercent}
        confirmed={!!month.salaryConfirmedAt}
        locked={closed || deposited}
        action={saveSalaryAction}
      />
      <DepositCard
        month={key}
        amount={split.savingsDeposit}
        salaryConfirmed={!!month.salaryConfirmedAt}
        deposited={deposited}
        closed={closed}
        action={confirmDepositAction}
      />
      <SadaqahCard month={key} amount={split.sadaqah} given={month.sadaqahGiven} closed={closed} action={sadaqahAction} />
      <ReimburseCard
        month={key}
        total={checklist.claimTotal}
        reimbursed={month.reimbursed}
        reimbursedAmount={month.reimbursedAmount}
        closed={closed}
        reimburseAction={reimburseAction}
        undoAction={undoReimburseAction}
      />
      <CashCountCard
        month={key}
        status={checklist.countStatus}
        last={last}
        expected={balance}
        closed={closed}
        countAction={cashCountAction}
        correctAction={correctCountAction}
        acceptAction={acceptCountAction}
      />
      <CloseCard month={key} canClose={checklist.canClose} closed={closed} action={closeMonthAction} />
    </>
  );
}
