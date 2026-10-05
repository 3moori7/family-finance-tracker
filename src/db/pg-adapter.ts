import { Pool, types, type PoolClient } from "pg";
import type { Db } from "./types";

types.setTypeParser(20, (v) => parseInt(v, 10)); // int8
types.setTypeParser(1700, (v) => parseFloat(v)); // numeric
types.setTypeParser(1082, (v) => v); // date as YYYY-MM-DD string
types.setTypeParser(1184, (v) => new Date(v).toISOString()); // timestamptz

function wrapClient(c: Pick<PoolClient, "query">, onTx?: <T>(fn: (db: Db) => Promise<T>) => Promise<T>): Db {
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await c.query(sql, params);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await c.query(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      return onTx ? onTx(fn) : fn(db);
    },
    async close() {},
  };
  return db;
}

export function createPgDb(connectionString: string): Db {
  const pool = new Pool({
    connectionString,
    max: 3,
    ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  const db = wrapClient(pool, async (fn) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(wrapClient(client));
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  });
  return { ...db, close: () => pool.end() };
}
