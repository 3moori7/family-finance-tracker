import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await db.query(
    "insert into settings(owner_email, owner_password_hash, salary_amount) values ('a@b.c','x', 1000000)",
  );
});

async function newMonth(key = "2026-03") {
  const [m] = await db.query<{ id: number }>(
    "insert into months(year_month, salary_base) values ($1, 1000000) returning id",
    [key],
  );
  return m.id;
}

describe("schema and rules", () => {
  it("applies migrations cleanly and is idempotent", async () => {
    const { runMigrations } = await import("@/db/migrate");
    expect(await runMigrations(db)).toEqual([]);
  });

  it("enforces month key format and uniqueness", async () => {
    await newMonth("2026-03");
    await expect(newMonth("2026-03")).rejects.toThrow();
    await expect(newMonth("2026-13")).rejects.toThrow();
  });

  it("requires a reason on withdrawals and corrections", async () => {
    const m = await newMonth();
    await db.query("insert into ledger_entries(type, amount) values ('opening', 100000)");
    await expect(
      db.query("insert into ledger_entries(month_id, type, amount) values ($1,'withdrawal', 100)", [m]),
    ).rejects.toThrow();
    await expect(
      db.query("insert into ledger_entries(month_id, type, amount, reason) values ($1,'correction', 5, '')", [m]),
    ).rejects.toThrow();
  });

  it("allows only one opening entry and one deposit per month", async () => {
    const m = await newMonth();
    await db.query("insert into ledger_entries(type, amount) values ('opening', 100)");
    await expect(db.query("insert into ledger_entries(type, amount) values ('opening', 5)")).rejects.toThrow();
    await db.query("insert into ledger_entries(month_id, type, amount) values ($1,'deposit', 725000)", [m]);
    await expect(
      db.query("insert into ledger_entries(month_id, type, amount) values ($1,'deposit', 1)", [m]),
    ).rejects.toThrow();
  });

  it("rejects withdrawals above the balance", async () => {
    const m = await newMonth();
    await db.query("insert into ledger_entries(type, amount) values ('opening', 10000)");
    await expect(
      db.query("insert into ledger_entries(month_id, type, amount, reason) values ($1,'withdrawal', 10001, 'x')", [m]),
    ).rejects.toThrow(/insufficient_balance/);
    await db.query("insert into ledger_entries(month_id, type, amount, reason) values ($1,'withdrawal', 10000, 'x')", [m]);
  });

  it("ledger is append-only", async () => {
    await db.query("insert into ledger_entries(type, amount) values ('opening', 100)");
    await expect(db.query("update ledger_entries set amount = 1")).rejects.toThrow(/ledger_append_only/);
    await expect(db.query("delete from ledger_entries")).rejects.toThrow(/ledger_append_only/);
  });

  it("rejects expenses dated outside their month", async () => {
    const m = await newMonth("2026-03");
    await expect(
      db.query("insert into family_expenses(month_id, amount, category, expense_date) values ($1,100,'home','2026-04-01')", [m]),
    ).rejects.toThrow(/date_month_mismatch/);
    await db.query("insert into family_expenses(month_id, amount, category, expense_date) values ($1,100,'home','2026-03-31')", [m]);
  });

  it("blocks expense changes once reimbursed", async () => {
    const m = await newMonth();
    await db.query("insert into family_expenses(month_id, amount, category, expense_date) values ($1,100,'home','2026-03-02')", [m]);
    await db.query("update months set reimbursed = true, reimbursed_amount = 100, reimbursed_at = now() where id = $1", [m]);
    await expect(
      db.query("insert into family_expenses(month_id, amount, category, expense_date) values ($1,5,'home','2026-03-03')", [m]),
    ).rejects.toThrow(/month_reimbursed/);
    await expect(db.query("delete from family_expenses")).rejects.toThrow(/month_reimbursed/);
  });

  it("refuses to close an incomplete month, then locks a complete one", async () => {
    const m = await newMonth();
    await expect(db.query("update months set status='closed' where id=$1", [m])).rejects.toThrow(/close_incomplete/);
    await db.query("update months set salary_confirmed_at = now() where id=$1", [m]);
    await db.query("insert into ledger_entries(type, amount) values ('opening', 100)");
    await db.query("insert into ledger_entries(month_id, type, amount) values ($1,'deposit', 725000)", [m]);
    await db.query("update months set sadaqah_given = true where id=$1", [m]);
    await db.query("insert into cash_counts(month_id, counted_amount, expected_amount, difference) values ($1, 725100, 725100, 0)", [m]);
    await db.query("update months set status='closed' where id=$1", [m]);

    // frozen afterwards
    await expect(db.query("update months set sadaqah_given = false where id=$1", [m])).rejects.toThrow(/month_closed/);
    await expect(db.query("delete from months where id=$1", [m])).rejects.toThrow(/month_delete_forbidden/);
    await expect(
      db.query("insert into family_expenses(month_id, amount, category, expense_date) values ($1,5,'home','2026-03-03')", [m]),
    ).rejects.toThrow(/month_closed/);
    await expect(
      db.query("insert into cash_counts(month_id, counted_amount, expected_amount, difference) values ($1, 1, 1, 0)", [m]),
    ).rejects.toThrow(/month_closed/);
    await expect(
      db.query("insert into ledger_entries(month_id, type, amount) values ($1,'withdrawal', 5)", [m]),
    ).rejects.toThrow();
    // ... but a correction is still allowed
    await db.query("insert into ledger_entries(month_id, type, amount, reason) values ($1,'correction', -50, 'miscount')", [m]);
  });

  it("freezes salary figures after the deposit is confirmed", async () => {
    const m = await newMonth();
    await db.query("insert into ledger_entries(month_id, type, amount) values ($1,'deposit', 100)", [m]);
    await expect(
      db.query("update months set salary_adjustment = 5, adjustment_note = 'x' where id=$1", [m]),
    ).rejects.toThrow(/deposit_exists/);
  });

  it("requires a note for a salary adjustment", async () => {
    const m = await newMonth();
    await expect(db.query("update months set salary_adjustment = 500 where id=$1", [m])).rejects.toThrow();
    await db.query("update months set salary_adjustment = 500, adjustment_note = 'bonus' where id=$1", [m]);
  });
});

describe("activity log", () => {
  it("records create, edit and delete with old and new values", async () => {
    const m = await newMonth();
    const [e] = await db.query<{ id: number }>(
      "insert into family_expenses(month_id, amount, category, expense_date) values ($1,100,'home','2026-03-02') returning id",
      [m],
    );
    await db.query("update family_expenses set amount = 250 where id = $1", [e.id]);
    await db.query("delete from family_expenses where id = $1", [e.id]);
    const rows = await db.query<{ action: string; old_value: Record<string, unknown>; new_value: Record<string, unknown> }>(
      "select action, old_value, new_value from activity_log where entity = 'family_expenses' order by id",
    );
    expect(rows.map((r) => r.action)).toEqual(["create", "edit", "delete"]);
    expect(rows[1].old_value.amount).toBe(100);
    expect(rows[1].new_value.amount).toBe(250);
    expect(rows[2].old_value.amount).toBe(250);
  });

  it("never stores password or PIN hashes", async () => {
    await db.query("update settings set pin_hash = 'secret-hash', owner_password_hash = 'other'");
    const rows = await db.query<{ new_value: Record<string, unknown> }>(
      "select new_value from activity_log where entity='settings' order by id desc limit 1",
    );
    expect(JSON.stringify(rows[0].new_value)).not.toContain("secret-hash");
    expect(JSON.stringify(rows[0].new_value)).not.toContain("other");
  });

  it("is immutable", async () => {
    await newMonth();
    await expect(db.query("update activity_log set entity='x'")).rejects.toThrow(/activity_log_immutable/);
    await expect(db.query("delete from activity_log")).rejects.toThrow(/activity_log_immutable/);
    await expect(db.query("truncate activity_log")).rejects.toThrow(/activity_log_immutable/);
  });
});

describe("row-level security", () => {
  it("lets the anonymous role read nothing", async () => {
    await db.exec("grant usage on schema public to anon; grant select on all tables in schema public to anon;");
    await db.exec("set role anon");
    const rows = await db.query("select * from settings");
    const months = await db.query("select * from months");
    await db.exec("reset role");
    expect(rows).toHaveLength(0);
    expect(months).toHaveLength(0);
  });
});
