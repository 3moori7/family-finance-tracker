import fs from "node:fs";
import path from "node:path";
import type { Db } from "./types";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

export async function runMigrations(db: Db, dir = MIGRATIONS_DIR): Promise<string[]> {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  const applied = new Set(
    (await db.query<{ name: string }>("select name from schema_migrations")).map((r) => r.name),
  );
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = fs.readFileSync(path.join(dir, file), "utf8");
    await db.tx(async (t) => {
      await t.exec(sql);
      await t.query("insert into schema_migrations(name) values ($1)", [file]);
    });
    ran.push(file);
  }
  return ran;
}
