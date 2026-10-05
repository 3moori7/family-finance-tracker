import fs from "node:fs";
import path from "node:path";
import { createPgDb } from "./pg-adapter";
import { createPgliteDb } from "./pglite-adapter";
import { runMigrations } from "./migrate";
import { bootstrapOwnerFromEnv } from "@/server/owner";
import type { Db } from "./types";

declare global {
  var __ffDb: Promise<Db> | undefined;
}

async function open(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  let db: Db;
  if (url) {
    db = createPgDb(url);
  } else {
    const dir = process.env.PGLITE_DIR ?? path.join(process.cwd(), ".data", "pglite");
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    db = await createPgliteDb(dir);
  }
  // Embedded dev database always migrates itself; production Postgres only when asked.
  if (!url || process.env.AUTO_MIGRATE === "1") await runMigrations(db);
  await bootstrapOwnerFromEnv(db);
  return db;
}

/** Process-wide singleton (survives Next.js hot reloads). */
export function getDb(): Promise<Db> {
  if (!globalThis.__ffDb) {
    globalThis.__ffDb = open().catch((e) => {
      globalThis.__ffDb = undefined; // allow a retry after a failed start
      throw e;
    });
  }
  return globalThis.__ffDb;
}

export type { Db } from "./types";
