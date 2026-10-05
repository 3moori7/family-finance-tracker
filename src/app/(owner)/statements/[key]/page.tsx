import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getDb } from "@/db/client";
import { Amount } from "@/components/ui/Amount";
import { PrintButton } from "@/components/ui/PrintButton";
import { isMonthKey } from "@/lib/months";
import { monthLabel } from "@/lib/month-label";
import { StatementRow, StatementSection } from "@/components/statement/parts";
import { buildStatement } from "@/server/statement";
import { requireOwner } from "@/server/session";

export default async function StatementPage({ params }: { params: Promise<{ key: string }> }) {
  await requireOwner(); // pages render alongside their layout, so they check the session themselves
  const { key } = await params;
  if (!isMonthKey(key)) notFound();
  const s = await buildStatement(await getDb(), key);
  if (!s) notFound();
  const t = await getTranslations("statement");
  const tc = await getTranslations("categories");
  const tl = await getTranslations("activity");
  const locale = (await getLocale()) as "ar" | "en";

  const generated = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
  }).format(new Date());

  return (
    <>
      <Link href="/statements" className="no-print text-sm font-medium text-primary">
        ‹ {t("back")}
      </Link>
      <header>
        <h1 className="text-xl font-bold">{t("heading", { month: monthLabel(key, locale) })}</h1>
        <p className="text-xs text-ink-soft">{t("generated", { date: generated })}</p>
      </header>
      <PrintButton label={t("print")} hint={t("printHint")} />

      <StatementSection title={t("salary")}>
        <StatementRow locale={locale} label={t("base")} value={s.salary.base} />
        {s.salary.adjustment !== 0 && (
          <StatementRow locale={locale} label={`${t("adjustment")}${s.salary.note ? ` (${s.salary.note})` : ""}`} value={s.salary.adjustment} />
        )}
        <StatementRow locale={locale} label={t("adjusted")} value={s.salary.adjusted} bold />
        <hr className="my-1 border-line" />
        <StatementRow locale={locale} label={t("toFather")} value={s.split.fatherShare} bold />
        <StatementRow locale={locale} label={`· ${t("savingsDeposit")}`} value={s.split.savingsDeposit} />
        <StatementRow locale={locale} label={`· ${t("sadaqah")}`} value={s.split.sadaqah} />
        <StatementRow locale={locale} label={t("keep")} value={s.split.ownerKeeps} bold />
        <p className="mt-1 text-xs text-ink-soft">
          {t("sadaqahStatus")}: {s.sadaqahGiven ? t("given") : t("notGiven")}
        </p>
      </StatementSection>

      <StatementSection title={t("savings")}>
        <StatementRow locale={locale} label={t("opening")} value={s.savings.opening} />
        <StatementRow locale={locale} label={t("deposits")} value={s.savings.deposits} />
        <StatementRow locale={locale} label={t("withdrawals")} value={-s.savings.withdrawals} />
        {s.savings.corrections !== 0 && <StatementRow locale={locale} label={t("corrections")} value={s.savings.corrections} />}
        <hr className="my-1 border-line" />
        <StatementRow locale={locale} label={t("closing")} value={s.savings.closing} bold />
        {s.savings.entries
          .filter((e) => e.type === "withdrawal" || e.type === "correction")
          .map((e) => (
            <p key={e.id} className="text-xs text-ink-soft">
              {tl(`ledger.${e.type}`)} · <span className="num">{e.date}</span> · {e.reason}
            </p>
          ))}
      </StatementSection>

      <StatementSection title={t("family")}>
        {s.family.breakdown.map((b) => (
          <StatementRow locale={locale} key={b.category} label={tc(b.category)} value={b.total} />
        ))}
        <hr className="my-1 border-line" />
        <StatementRow locale={locale} label={t("total")} value={s.family.total} bold />
        <p className="mt-1 text-xs text-ink-soft">
          {t("reimbursement")}:{" "}
          {s.reimbursed.done ? `${t("reimbursed")}` : s.family.total === 0 ? "—" : t("notReimbursed")}
        </p>
        {s.family.items.length > 0 && (
          <details className="mt-2">
            <summary className="no-print min-h-9 cursor-pointer text-sm font-medium text-primary">{t("items")}</summary>
            <ul className="mt-1 flex flex-col gap-1 text-xs">
              {s.family.items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="text-ink-soft">
                    <span className="num">{i.date}</span> · {tc(i.category)}
                    {i.note ? ` · ${i.note}` : ""}
                  </span>
                  <Amount value={i.amount} locale={locale} />
                </li>
              ))}
            </ul>
          </details>
        )}
      </StatementSection>

      <StatementSection title={t("cashCount")}>
        {s.cashCount ? (
          <>
            <StatementRow locale={locale} label={t("counted")} value={s.cashCount.counted} />
            <StatementRow locale={locale} label={t("expected")} value={s.cashCount.expected} />
            <StatementRow locale={locale} label={t("difference")} value={s.cashCount.difference} bold />
            <p className="text-xs text-ink-soft">
              {s.cashCount.difference === 0 ? t("matches") : s.cashCount.note ?? ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-ink-soft">{t("noCount")}</p>
        )}
      </StatementSection>
    </>
  );
}
