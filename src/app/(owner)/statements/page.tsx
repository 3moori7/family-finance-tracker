import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { Amount } from "@/components/ui/Amount";
import { EmptyState } from "@/components/ui/EmptyState";
import { monthLabel } from "@/lib/month-label";
import { listStatementMonths } from "@/server/statement";
import { requireOwner } from "@/server/session";

export default async function StatementsPage() {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const t = await getTranslations("statement");
  const locale = (await getLocale()) as "ar" | "en";
  const months = await listStatementMonths(await getDb());
  return (
    <>
      <h1 className="text-xl font-bold">{t("title")}</h1>
      {months.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {months.map((m) => (
            <li key={m.key}>
              <Link href={`/statements/${m.key}`} className="flex min-h-14 items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4">
                <div>
                  <p className="font-semibold">{monthLabel(m.key, locale)}</p>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.status === "closed" ? "bg-surface-2 text-ink-soft" : "bg-gold-soft text-gold"}`}>
                    {m.status === "closed" ? t("closed") : t("open")}
                  </span>
                </div>
                <div className="text-end text-xs text-ink-soft">
                  <p>{t("claim")}</p>
                  <Amount value={m.claim} locale={locale} className="text-sm font-semibold text-ink" />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
