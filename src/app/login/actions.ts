"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/db/client";
import { verifySecret } from "@/lib/security";
import { clearFailures, isLocked, recordFailure } from "@/server/rate-limit";
import { clientIp } from "@/server/client-ip";
import { endOwnerSession, startOwnerSession } from "@/server/session";

export type LoginState = { error?: "invalid" | "locked" | "noOwner" | "missing" };

const schema = z.object({ email: z.string().trim().min(3).max(200), password: z.string().min(1).max(200) });

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: "missing" };

  const db = await getDb();
  const ipScope = `login:ip:${await clientIp()}`;
  if ((await isLocked(db, ipScope)) || (await isLocked(db, "login:all", 25))) return { error: "locked" };

  const [owner] = await db.query<{ owner_email: string; owner_password_hash: string }>(
    "select owner_email, owner_password_hash from settings where id = 1",
  );
  if (!owner) return { error: "noOwner" };

  const emailOk = owner.owner_email.toLowerCase() === parsed.data.email.toLowerCase();
  const passOk = verifySecret(parsed.data.password, owner.owner_password_hash);
  if (!emailOk || !passOk) {
    await recordFailure(db, ipScope);
    await recordFailure(db, "login:all");
    return { error: "invalid" };
  }
  await clearFailures(db, ipScope);
  await startOwnerSession();
  redirect("/");
}

export async function logout() {
  await endOwnerSession();
  redirect("/login");
}
