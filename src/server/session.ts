import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { signSession, verifySession, type TokenPayload } from "@/lib/security";
import { sessionSecret } from "./env";

export const OWNER_COOKIE = "ff_owner";
export const FATHER_COOKIE = "ff_father";
const OWNER_TTL = 60 * 60 * 24 * 30; // 30 days
const FATHER_TTL = 60 * 60 * 24 * 7; // 7 days

const baseCookie = () => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
});

export async function startOwnerSession() {
  const exp = Math.floor(Date.now() / 1000) + OWNER_TTL;
  const token = signSession({ role: "owner", exp }, sessionSecret());
  (await cookies()).set(OWNER_COOKIE, token, { ...baseCookie(), maxAge: OWNER_TTL });
}

export async function endOwnerSession() {
  (await cookies()).delete(OWNER_COOKIE);
}

export async function startFatherSession(version: number) {
  const exp = Math.floor(Date.now() / 1000) + FATHER_TTL;
  const token = signSession({ role: "father", exp, v: version }, sessionSecret());
  (await cookies()).set(FATHER_COOKIE, token, { ...baseCookie(), maxAge: FATHER_TTL });
}

export async function endFatherSession() {
  (await cookies()).delete(FATHER_COOKIE);
}

export async function getOwnerSession(): Promise<TokenPayload | null> {
  const token = (await cookies()).get(OWNER_COOKIE)?.value;
  const p = verifySession(token, sessionSecret());
  return p?.role === "owner" ? p : null;
}

export async function getFatherSession(): Promise<TokenPayload | null> {
  const token = (await cookies()).get(FATHER_COOKIE)?.value;
  const p = verifySession(token, sessionSecret());
  return p?.role === "father" ? p : null;
}

/** Use at the top of every owner page and server action. */
export async function requireOwner(): Promise<TokenPayload> {
  const s = await getOwnerSession();
  if (!s) redirect("/login");
  return s;
}

/** For route handlers: returns false instead of redirecting. */
export async function isOwner(): Promise<boolean> {
  return (await getOwnerSession()) !== null;
}
