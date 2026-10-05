import type { Db } from "@/db/types";

export type Audience = "owner" | "father";

export interface ActivityRow {
  id: number;
  entity: string;
  entityId: string | null;
  action: "create" | "edit" | "delete";
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  createdAt: string;
}

export const ENTITIES = [
  "ledger_entries",
  "family_expenses",
  "personal_expenses",
  "cash_counts",
  "months",
  "settings",
] as const;
export type Entity = (typeof ENTITIES)[number];

/** Keys of a month row the father may see (never the salary figures or notes). */
const FATHER_MONTH_KEYS = ["status", "reimbursed", "reimbursed_amount", "sadaqah_given", "year_month"];

function pick(v: Record<string, unknown> | null, keys: string[]) {
  if (!v) return null;
  return Object.fromEntries(keys.filter((k) => k in v).map((k) => [k, v[k]]));
}

export async function listActivity(
  db: Db,
  opts: { audience: Audience; monthKey?: string; entity?: string; limit?: number; offset?: number },
): Promise<{ rows: ActivityRow[]; hasMore: boolean }> {
  const limit = opts.limit ?? 30;
  const entityFilter = opts.entity && (ENTITIES as readonly string[]).includes(opts.entity) ? opts.entity : null;
  const fatherSql =
    opts.audience === "father"
      ? `and (
           entity in ('ledger_entries', 'cash_counts')
           or (entity = 'months' and action = 'edit' and (
                old_value->>'status' is distinct from new_value->>'status'
             or old_value->>'reimbursed' is distinct from new_value->>'reimbursed'
             or old_value->>'sadaqah_given' is distinct from new_value->>'sadaqah_given'))
         )`
      : "";
  const rows = await db.query<{
    id: number; entity: string; entity_id: string | null; action: ActivityRow["action"];
    old_value: Record<string, unknown> | null; new_value: Record<string, unknown> | null; created_at: string;
  }>(
    `select id, entity, entity_id, action, old_value, new_value, created_at from activity_log
     where ($1::text is null or to_char(created_at at time zone 'Asia/Riyadh', 'YYYY-MM') = $1)
       and ($2::text is null or entity = $2)
       ${fatherSql}
     order by id desc limit $3 offset $4`,
    [opts.monthKey ?? null, entityFilter, limit + 1, opts.offset ?? 0],
  );
  const page = rows.slice(0, limit).map((r): ActivityRow => {
    const sanitize = opts.audience === "father" && r.entity === "months";
    return {
      id: r.id,
      entity: r.entity,
      entityId: r.entity_id,
      action: r.action,
      oldValue: sanitize ? pick(r.old_value, FATHER_MONTH_KEYS) : r.old_value,
      newValue: sanitize ? pick(r.new_value, FATHER_MONTH_KEYS) : r.new_value,
      createdAt: r.created_at,
    };
  });
  return { rows: page, hasMore: rows.length > limit };
}
