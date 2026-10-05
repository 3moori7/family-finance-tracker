import ExcelJS from "exceljs";
import type { Db } from "@/db/types";

export const TABLES = [
  "settings",
  "months",
  "ledger_entries",
  "family_expenses",
  "cash_counts",
  "personal_expenses",
  "activity_log",
] as const;
export type TableName = (typeof TABLES)[number];

export interface Dump {
  version: 1;
  exportedAt: string;
  tables: Record<TableName, Record<string, unknown>[]>;
}

const SECRET_COLUMNS = ["owner_password_hash", "pin_hash", "view_token_hash"];

/** Full-fidelity copy of the data. Password, PIN and link hashes are never included. */
export async function dumpAll(db: Db): Promise<Dump> {
  const tables = {} as Dump["tables"];
  for (const t of TABLES) {
    const rows = await db.query<Record<string, unknown>>(`select * from ${t} order by ${t === "settings" ? "id" : "id"}`);
    tables[t] = rows.map((r) => {
      if (t !== "settings") return r;
      const copy = { ...r };
      for (const c of SECRET_COLUMNS) delete copy[c];
      return copy;
    });
  }
  return { version: 1, exportedAt: new Date().toISOString(), tables };
}

const sar = (v: unknown) => (typeof v === "number" ? v / 100 : null);

export async function buildWorkbook(dump: Dump): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.created = new Date(dump.exportedAt);
  const sheet = (
    name: string,
    columns: { header: string; key: string; width?: number; money?: boolean }[],
    rows: Record<string, unknown>[],
  ) => {
    const ws = wb.addWorksheet(name, { views: [{ rightToLeft: false, state: "frozen", ySplit: 1 }] });
    ws.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 16 }));
    for (const r of rows) {
      ws.addRow(Object.fromEntries(columns.map((c) => [c.key, c.money ? sar(r[c.key]) : r[c.key]])));
    }
    for (const c of columns) if (c.money) ws.getColumn(c.key).numFmt = "#,##0.00";
    ws.getRow(1).font = { bold: true };
  };
  const t = dump.tables;
  const monthKey = new Map(t.months.map((m) => [m.id as number, m.year_month as string]));
  sheet("Months", [
    { header: "Month", key: "year_month" }, { header: "Status", key: "status" },
    { header: "Base salary (SAR)", key: "salary_base", money: true }, { header: "Adjustment (SAR)", key: "salary_adjustment", money: true },
    { header: "Adjustment note", key: "adjustment_note", width: 28 }, { header: "Sadaqah given", key: "sadaqah_given" },
    { header: "Reimbursed", key: "reimbursed" }, { header: "Reimbursed (SAR)", key: "reimbursed_amount", money: true },
    { header: "Closed at", key: "closed_at", width: 24 },
  ], t.months);
  sheet("Savings ledger", [
    { header: "Date", key: "entry_date" }, { header: "Month", key: "month" }, { header: "Type", key: "type" },
    { header: "Amount (SAR)", key: "amount", money: true }, { header: "Reason", key: "reason", width: 32 },
  ], t.ledger_entries.map((e) => ({ ...e, month: monthKey.get(e.month_id as number) ?? "" })));
  sheet("Family expenses", [
    { header: "Date", key: "expense_date" }, { header: "Month", key: "month" }, { header: "Category", key: "category" },
    { header: "Amount (SAR)", key: "amount", money: true }, { header: "Note", key: "note", width: 32 },
  ], t.family_expenses.map((e) => ({ ...e, month: monthKey.get(e.month_id as number) ?? "" })));
  sheet("Personal expenses", [
    { header: "Date", key: "expense_date" }, { header: "Category", key: "category" },
    { header: "Amount (SAR)", key: "amount", money: true }, { header: "Note", key: "note", width: 32 },
  ], t.personal_expenses);
  sheet("Cash counts", [
    { header: "Month", key: "month" }, { header: "Counted (SAR)", key: "counted_amount", money: true },
    { header: "Expected (SAR)", key: "expected_amount", money: true }, { header: "Difference (SAR)", key: "difference", money: true },
    { header: "Accepted", key: "accepted_difference" }, { header: "Note", key: "note", width: 32 }, { header: "At", key: "created_at", width: 24 },
  ], t.cash_counts.map((c) => ({ ...c, month: monthKey.get(c.month_id as number) ?? "" })));
  sheet("Activity log", [
    { header: "At", key: "created_at", width: 24 }, { header: "What", key: "entity" }, { header: "Action", key: "action" },
    { header: "Before", key: "old", width: 40 }, { header: "After", key: "new", width: 40 },
  ], t.activity_log.map((a) => ({ ...a, old: a.old_value ? JSON.stringify(a.old_value) : "", new: a.new_value ? JSON.stringify(a.new_value) : "" })));
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const JSON_COLUMNS = new Set(["old_value", "new_value"]);

/**
 * Loads a dump into an EMPTY, migrated database, keeping ids and history. Triggers are bypassed
 * (session_replication_role = replica) so closed months and the append-only log restore as they were.
 * Secrets are not part of a dump: the owner is restored with a locked password and must run
 * `npm run create-owner`; father access must be enabled again.
 */
export async function restoreAll(db: Db, dump: Dump): Promise<void> {
  if (dump.version !== 1) throw new Error("Unsupported backup version");
  await db.tx(async (t) => {
    const [{ n }] = await t.query<{ n: number }>(
      "select ((select count(*) from settings) + (select count(*) from months) + (select count(*) from ledger_entries) + (select count(*) from activity_log))::int as n",
    );
    if (n > 0) throw new Error("The target database is not empty");
    await t.exec("set local session_replication_role = replica");
    for (const table of TABLES) {
      for (const row of dump.tables[table]) {
        const data: Record<string, unknown> = { ...row };
        if (table === "settings") data.owner_password_hash = "!locked";
        const cols = Object.keys(data);
        const values = cols.map((c) => (JSON_COLUMNS.has(c) && data[c] !== null ? JSON.stringify(data[c]) : data[c]));
        const placeholders = cols.map((c, i) => (JSON_COLUMNS.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`));
        await t.query(`insert into ${table} (${cols.join(", ")}) values (${placeholders.join(", ")})`, values);
      }
      if (table !== "settings") {
        await t.query(
          `select setval(pg_get_serial_sequence('${table}', 'id'), greatest((select coalesce(max(id), 0) from ${table}), 1), (select count(*) > 0 from ${table}))`,
        );
      }
    }
  });
}
