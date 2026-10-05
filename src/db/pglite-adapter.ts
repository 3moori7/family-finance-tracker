import { PGlite, types } from "@electric-sql/pglite";
import type { Db } from "./types";

const parsers = {
  [types.INT8]: (v: string) => parseInt(v, 10),
  [types.NUMERIC]: (v: string) => parseFloat(v),
  [types.DATE]: (v: string) => v,
  [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
  [types.TIMESTAMP]: (v: string) => new Date(v + "Z").toISOString(),
};

type Queryable = Pick<PGlite, "query" | "exec">;

function wrap(q: Queryable, root?: PGlite): Db {
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await q.query(sql, params, { parsers });
      return res.rows as T[];
    },
    async exec(sql: string) {
      await q.exec(sql);
    },
    async tx<T>(fn: (db: Db) => Promise<T>) {
      if (!root) return fn(db); // already inside a transaction
      return root.transaction(async (t) => fn(wrap(t)));
    },
    async close() {
      if (root) await root.close();
    },
  };
  return db;
}

/** dataDir undefined => in-memory database. */
export async function createPgliteDb(dataDir?: string): Promise<Db> {
  const pg = dataDir ? await PGlite.create(dataDir) : await PGlite.create();
  return wrap(pg, pg);
}
