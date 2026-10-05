import Link from "next/link";
import { Amount } from "@/components/ui/Amount";
import { Card, CardTitle } from "@/components/ui/Card";

interface Labels {
  savings: string;
  claim: string;
  claimMonth: string;
  statusToClaim: string;
  statusSettled: string;
  nothing: string;
}

/** The two answers the owner and the father care about. `readOnly` removes all links. */
export function HomeCards({
  balance,
  claimTotal,
  claimCount,
  reimbursed,
  locale,
  labels,
  readOnly = false,
}: {
  balance: number;
  claimTotal: number;
  claimCount: number;
  reimbursed: boolean;
  locale: "ar" | "en";
  labels: Labels;
  readOnly?: boolean;
}) {
  const wrap = (href: string, node: React.ReactNode) =>
    readOnly ? <div>{node}</div> : <Link href={href} className="block active:opacity-80">{node}</Link>;
  return (
    <>
      {wrap(
        "/savings",
        <Card className="border-primary/20 bg-primary-soft/40">
          <CardTitle>{labels.savings}</CardTitle>
          <Amount value={balance} locale={locale} className="mt-1 block text-4xl font-bold text-primary" />
        </Card>,
      )}
      {wrap(
        "/expenses",
        <Card>
          <div className="flex items-start justify-between">
            <CardTitle>{labels.claim}</CardTitle>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${reimbursed ? "bg-ok-soft text-ok" : "bg-gold-soft text-gold"}`}
            >
              {reimbursed ? labels.statusSettled : labels.statusToClaim}
            </span>
          </div>
          <Amount value={claimTotal} locale={locale} className="mt-1 block text-3xl font-bold" />
          <p className="mt-1 text-xs text-ink-soft">{claimCount === 0 ? labels.nothing : labels.claimMonth}</p>
        </Card>,
      )}
    </>
  );
}
