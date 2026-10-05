import { formatSar } from "./money";

type V = Record<string, unknown> | null;
export type Translate = (key: string, values?: Record<string, string | number>) => string;

const num = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));
const str = (v: unknown) => (v == null ? "" : String(v));

export interface Described {
  title: string;
  detail: string;
}

/** Turns one raw activity-log row into short, human text. `t` is namespaced to "activity". */
export function describeActivity(
  row: { entity: string; action: "create" | "edit" | "delete"; oldValue: V; newValue: V },
  t: Translate,
  locale: "ar" | "en",
  tCategory: (c: string) => string,
): Described {
  const money = (v: unknown) => formatSar(num(v), locale);
  const cur = row.newValue ?? row.oldValue ?? {};
  const title = `${t(`entity.${row.entity}`)} · ${t(`action.${row.action}`)}`;
  const parts: string[] = [];

  switch (row.entity) {
    case "family_expenses":
    case "personal_expenses": {
      if (row.action === "edit" && row.oldValue && row.newValue && row.oldValue.amount !== row.newValue.amount) {
        parts.push(`${money(row.oldValue.amount)} → ${money(row.newValue.amount)}`);
      } else parts.push(money(cur.amount));
      parts.push(tCategory(str(cur.category)));
      if (cur.note) parts.push(str(cur.note));
      break;
    }
    case "ledger_entries": {
      parts.push(`${t(`ledger.${str(cur.type)}`)} ${money(cur.amount)}`);
      if (cur.reason) parts.push(str(cur.reason));
      break;
    }
    case "cash_counts": {
      parts.push(`${t("counted")} ${money(cur.counted_amount)}`);
      parts.push(`${t("expected")} ${money(cur.expected_amount)}`);
      if (num(cur.difference) !== 0) parts.push(`${t("difference")} ${money(cur.difference)}`);
      if (cur.accepted_difference) parts.push(t("acceptedDifference"));
      if (cur.note) parts.push(str(cur.note));
      break;
    }
    case "months": {
      const o = row.oldValue ?? {};
      const n = row.newValue ?? {};
      if (row.action === "create") {
        parts.push(str(n.year_month));
        break;
      }
      if (o.status !== n.status && n.status === "closed") parts.push(`${t("monthClosed")} ${str(n.year_month)}`);
      if (o.reimbursed !== n.reimbursed && "reimbursed" in n) {
        parts.push(n.reimbursed ? `${t("reimbursed")} ${money(n.reimbursed_amount)}` : t("reimbursedUndone"));
      }
      if (o.sadaqah_given !== n.sadaqah_given && "sadaqah_given" in n) {
        parts.push(n.sadaqah_given ? t("sadaqahGiven") : t("sadaqahUndone"));
      }
      if ("salary_adjustment" in n && o.salary_adjustment !== n.salary_adjustment) {
        parts.push(`${t("salaryAdjustment")} ${money(n.salary_adjustment)}`);
      }
      if (parts.length === 0 && "salary_confirmed_at" in n && o.salary_confirmed_at !== n.salary_confirmed_at) {
        parts.push(t("salaryConfirmed"));
      }
      break;
    }
    case "settings":
      parts.push(t("settingsChanged"));
      break;
  }
  return { title, detail: parts.filter(Boolean).join(" · ") };
}
