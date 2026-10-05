import Link from "next/link";
import { getLocale } from "next-intl/server";
import { monthLabel } from "@/lib/month-label";

/** Steps between months using the ?m=YYYY-MM query parameter. */
export async function MonthSwitcher({
  monthKey,
  basePath,
  prevKey,
  nextKey,
}: {
  monthKey: string;
  basePath: string;
  prevKey: string | null;
  nextKey: string | null;
}) {
  const locale = (await getLocale()) as "ar" | "en";
  const arrow = "flex size-11 items-center justify-center rounded-xl border border-line bg-surface text-lg";
  const rtl = locale === "ar";
  return (
    <div className="flex items-center justify-between gap-2">
      {prevKey ? (
        <Link href={`${basePath}?m=${prevKey}`} className={arrow} aria-label="previous month">
          {rtl ? "›" : "‹"}
        </Link>
      ) : (
        <span className={`${arrow} opacity-30`}>{rtl ? "›" : "‹"}</span>
      )}
      <span className="text-base font-semibold">{monthLabel(monthKey, locale)}</span>
      {nextKey ? (
        <Link href={`${basePath}?m=${nextKey}`} className={arrow} aria-label="next month">
          {rtl ? "‹" : "›"}
        </Link>
      ) : (
        <span className={`${arrow} opacity-30`}>{rtl ? "‹" : "›"}</span>
      )}
    </div>
  );
}
