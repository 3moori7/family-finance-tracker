import type { Db } from "@/db/types";

export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;

/** True when too many failures were recorded for this scope inside the window. */
export async function isLocked(db: Db, scope: string, max = MAX_FAILURES): Promise<boolean> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from auth_attempts
     where scope = $1 and created_at > now() - ($2 || ' minutes')::interval`,
    [scope, String(WINDOW_MINUTES)],
  );
  return row.n >= max;
}

export async function recordFailure(db: Db, scope: string): Promise<void> {
  await db.query("insert into auth_attempts(scope) values ($1)", [scope]);
  // keep the table small
  await db.query("delete from auth_attempts where created_at < now() - interval '1 day'");
}

export async function clearFailures(db: Db, scope: string): Promise<void> {
  await db.query("delete from auth_attempts where scope = $1", [scope]);
}
