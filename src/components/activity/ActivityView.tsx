import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { describeActivity } from "@/lib/activity";
import { isMonthKey } from "@/lib/months";
import { listActivity, ENTITIES, type Audience } from "@/server/activity";
import { getDb } from "@/db/client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

const PAGE = 30;

/** Read-only change history, shared by the owner page and the father's page. */
export async function ActivityView({
  audience,
  basePath,
  params,
}: {
  audience: Audience;
  basePath: string;
  params: { m?: string; type?: string; page?: string };
}) {
  const t = await getTranslations("activity");
  const tc = await getTranslations("categories");
  const locale = (await getLocale()) as "ar" | "en";
  const month = params.m && isMonthKey(params.m) ? params.m : undefined;
  const type = params.type && (ENTITIES as readonly string[]).includes(params.type) ? params.type : undefined;
  const page = Math.max(0, Number(params.page ?? 0) || 0);
  const { rows, hasMore } = await listActivity(await getDb(), {
    audience,
    monthKey: month,
    entity: type,
    limit: PAGE,
    offset: page * PAGE,
  });
  const types: readonly string[] =
    audience === "father" ? ["ledger_entries", "cash_counts", "months"] : ENTITIES;
  const qs = (p: number) => {
    const sp = new URLSearchParams();
    if (month) sp.set("m", month);
    if (type) sp.set("type", type);
    if (p > 0) sp.set("page", String(p));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const time = new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-nu-latn" : "en-GB", {
    timeZone: "Asia/Riyadh",
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <>
      <p className="text-sm text-ink-soft">{t("intro")}</p>
      <form method="get" action={basePath} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t("filterType")}
            <select name="type" defaultValue={type ?? ""} className="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm">
              <option value="">{t("all")}</option>
              {types.map((e) => (
                <option key={e} value={e}>
                  {t(`entity.${e}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium">
            {t("filterMonth")}
            <input type="month" name="m" defaultValue={month ?? ""} dir="ltr" className="min-h-11 rounded-lg border border-line bg-surface px-2 text-sm" />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit" className="min-h-11 flex-1">
            {t("apply")}
          </Button>
          <Link href={basePath} className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium">
            {t("clear")}
          </Link>
        </div>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const d = describeActivity(r, (k, v) => t(k, v), locale, (c) => tc(c));
            return (
              <li key={r.id} className="rounded-xl border border-line bg-surface px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{d.title}</span>
                  <span className="num shrink-0 text-xs text-ink-soft">{time.format(new Date(r.createdAt))}</span>
                </div>
                {d.detail && <p className="mt-0.5 break-words text-sm text-ink-soft">{d.detail}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {(hasMore || page > 0) && (
        <div className="flex justify-between gap-2">
          {page > 0 ? (
            <Link href={qs(page - 1)} className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium">
              ‹
            </Link>
          ) : (
            <span />
          )}
          {hasMore && (
            <Link href={qs(page + 1)} className="flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium">
              {t("more")} ›
            </Link>
          )}
        </div>
      )}
    </>
  );
}
