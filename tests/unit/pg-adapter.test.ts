import net from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPgDb } from "@/db/pg-adapter";
import { runMigrations } from "@/db/migrate";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { addFamilyExpense, listFamilyExpenses, markReimbursed } from "@/server/expenses";
import { findMonth } from "@/server/months";
import { getBalance, addWithdrawal } from "@/server/ledger";
import { dumpAll, restoreAll } from "@/server/backup";
import { createTestDb } from "@/db/test-utils";

// Production talks to Postgres through the `pg` driver. This runs that exact adapter over the real
// Postgres wire protocol (PGlite exposed on a local TCP port) so type parsing, transactions and error
// propagation are verified without needing a Postgres server on the machine.

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address() as net.AddressInfo;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

let server: PGLiteSocketServer;
let backing: PGlite;
let db: Db;

beforeAll(async () => {
  backing = await PGlite.create();
  const port = await freePort();
  server = new PGLiteSocketServer({ db: backing, port, host: "127.0.0.1", maxConnections: 8 });
  await server.start();
  db = createPgDb(`postgresql://postgres:postgres@127.0.0.1:${port}/postgres`);
});

afterAll(async () => {
  await db.close();
  await server.stop();
  await backing.close();
});

describe("pg adapter over the Postgres protocol", () => {
  it("applies the migrations and the app works end to end", async () => {
    expect((await runMigrations(db)).length).toBeGreaterThanOrEqual(5);
    expect(await runMigrations(db)).toEqual([]);
    await upsertOwner(db, "o@x.co", "a-long-password");
    await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
    await addFamilyExpense(db, { amount: 8000, category: "car", date: "2026-03-02", note: "fuel" });

    const month = (await findMonth(db, "2026-03"))!;
    const [e] = await listFamilyExpenses(db, month.id);
    // bigint -> number, date -> plain string, not Date objects
    expect(e).toMatchObject({ amount: 8000, date: "2026-03-02", category: "car" });
    expect(typeof e.amount).toBe("number");
    expect(typeof month.id).toBe("number");
    expect(await getBalance(db)).toBe(2500000);
  });

  it("returns numeric, timestamp and jsonb values in usable shapes", async () => {
    const [r] = await db.query<{ p: number; t: string; j: { a: number }; d: string }>(
      "select 75.25::numeric(5,2) as p, now() as t, '{\"a\": 1}'::jsonb as j, date '2026-03-02' as d",
    );
    expect(r.p).toBe(75.25);
    expect(typeof r.t).toBe("string");
    expect(new Date(r.t).toISOString()).toBe(r.t);
    expect(r.j).toEqual({ a: 1 });
    expect(r.d).toBe("2026-03-02");
  });

  it("rolls a failed transaction back completely", async () => {
    const before = await getBalance(db);
    await expect(
      db.tx(async (t) => {
        await addWithdrawal(t, { amount: 100, reason: "inside tx", date: "2026-03-03" });
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(await getBalance(db)).toBe(before);
  });

  it("surfaces database rule errors with their stable codes", async () => {
    await expect(addWithdrawal(db, { amount: 999999999, reason: "too much", date: "2026-03-03" })).rejects.toMatchObject({
      code: "insufficient_balance",
    });
    await markReimbursed(db, "2026-03");
    await expect(addFamilyExpense(db, { amount: 1, category: "home", date: "2026-03-05", note: null })).rejects.toThrow(
      /month_reimbursed/,
    );
  });

  it("handles concurrent requests", async () => {
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => db.query<{ n: number }>("select $1::int as n", [i])));
    expect(results.map((r) => r[0].n)).toEqual(Array.from({ length: 12 }, (_, i) => i));
  });

  it("dumps and restores through the same driver", async () => {
    const dump = await dumpAll(db);
    const fresh = await createTestDb();
    await restoreAll(fresh, dump);
    expect((await dumpAll(fresh)).tables).toEqual(dump.tables);
  });
});
