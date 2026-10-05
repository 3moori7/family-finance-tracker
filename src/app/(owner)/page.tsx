import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { HomeCards } from "@/components/home/HomeCards";
import { monthLabel } from "@/lib/month-label";
import { monthClaim } from "@/server/expenses";
import { getBalance } from "@/server/ledger";
import { currentMonthKey, getOrCreateMonth } from "@/server/months";
import { requireOwner } from "@/server/session";

export default async function HomePage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const db = await getDb();
  const t = await getTranslations("home");
  const locale = (await getLocale()) as "ar" | "en";
  const key = await currentMonthKey(db);
  const month = await getOrCreateMonth(db, key);
  const [balance, claim] = await Promise.all([getBalance(db), monthClaim(db, month.id)]);
  return (
    <>
      <HomeCards
        balance={balance}
        claimTotal={claim.total}
        claimCount={claim.count}
        reimbursed={month.reimbursed}
        locale={locale}
        labels={{
          savings: t("savings"),
          claim: t("claim"),
          claimMonth: monthLabel(key, locale),
          statusToClaim: t("statusToClaim"),
          statusSettled: t("statusSettled"),
          nothing: t("nothing"),
        }}
      />
      <Link href="/month" className="flex min-h-12 items-center justify-between rounded-xl border border-line bg-surface px-4 font-medium">
        {t("goMonth")}
        <span className="text-ink-soft">›</span>
      </Link>
    </>
  );
}
