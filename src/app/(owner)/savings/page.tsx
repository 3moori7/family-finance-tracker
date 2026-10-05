import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { WithdrawForm } from "@/components/month/WithdrawForm";
import { Amount } from "@/components/ui/Amount";
import { Card, CardTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { getBalance, listLedger } from "@/server/ledger";
import { withdrawAction } from "./actions";
import { requireOwner } from "@/server/session";

const tone = {
  opening: "bg-surface-2 text-ink-soft",
  deposit: "bg-ok-soft text-ok",
  withdrawal: "bg-danger-soft text-danger",
  correction: "bg-gold-soft text-gold",
} as const;

export default async function SavingsPage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const db = await getDb();
  const t = await getTranslations("savings");
  const locale = (await getLocale()) as "ar" | "en";
  const [balance, entries] = await Promise.all([getBalance(db), listLedger(db)]);
  return (
    <>
      <Card>
        <CardTitle>{t("balance")}</CardTitle>
        <Amount value={balance} locale={locale} className="mt-1 block text-3xl font-bold text-primary" />
        <p className="mt-1 text-xs text-ink-soft">{t("expectedNote")}</p>
      </Card>
      <WithdrawForm action={withdrawAction} />
      <h2 className="text-sm font-medium text-ink-soft">{t("history")}</h2>
      {entries.length === 0 ? (
        <EmptyState title={t("history")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {entries.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div className="min-w-0">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone[e.type]}`}>{t(e.type)}</span>
                <p className="mt-1 truncate text-xs text-ink-soft">
                  <span className="num">{e.entryDate}</span>
                  {e.reason ? ` · ${e.reason}` : ""}
                </p>
              </div>
              <Amount
                value={e.type === "withdrawal" ? -e.amount : e.amount}
                locale={locale}
                signed={e.type !== "opening"}
                className="font-semibold"
              />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
