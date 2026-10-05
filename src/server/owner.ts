import type { Db } from "@/db/types";
import { hashSecret } from "@/lib/security";

export async function ownerExists(db: Db): Promise<boolean> {
  const rows = await db.query("select 1 from settings where id = 1");
  return rows.length > 0;
}

/** Create or reset the single owner account. */
export async function upsertOwner(db: Db, email: string, password: string): Promise<void> {
  const hash = hashSecret(password);
  await db.query(
    `insert into settings (id, owner_email, owner_password_hash) values (1, $1, $2)
     on conflict (id) do update set owner_email = excluded.owner_email,
       owner_password_hash = excluded.owner_password_hash, updated_at = now()`,
    [email.trim().toLowerCase(), hash],
  );
}

/** First-start bootstrap: create the owner from OWNER_EMAIL / OWNER_PASSWORD if none exists. */
export async function bootstrapOwnerFromEnv(db: Db): Promise<boolean> {
  const email = process.env.OWNER_EMAIL;
  const password = process.env.OWNER_PASSWORD;
  if (!email || !password) return false;
  if (await ownerExists(db)) return false;
  await upsertOwner(db, email, password);
  return true;
}
