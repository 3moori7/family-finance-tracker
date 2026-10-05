import { createPgliteDb } from "./pglite-adapter";
import { runMigrations } from "./migrate";
import type { Db } from "./types";

/** Fresh in-memory migrated database for tests. */
export async function createTestDb(): Promise<Db> {
  const db = await createPgliteDb();
  await runMigrations(db);
  return db;
}
