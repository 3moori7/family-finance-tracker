import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** Format: scrypt$<saltHex>$<hashHex> */
export function hashSecret(secret: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(secret, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifySecret(secret: string, stored: string | null | undefined): boolean {
  // Always do the work, so wrong users and wrong passwords take the same time.
  const parts = (stored ?? "").split("$");
  const valid = parts.length === 3 && parts[0] === "scrypt";
  const salt = Buffer.from(valid ? parts[1] : "00".repeat(16), "hex");
  const expected = Buffer.from(valid ? parts[2] : "00".repeat(SCRYPT.keylen), "hex");
  const actual = scryptSync(secret, salt, expected.length, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return valid && expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export interface TokenPayload {
  role: "owner" | "father";
  exp: number; // unix seconds
  /** father sessions carry the link version so rotating the link invalidates them */
  v?: number;
}

function sign(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function signSession(payload: TokenPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifySession(
  token: string | undefined,
  secret: string,
  now = Math.floor(Date.now() / 1000),
): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig || !safeEqual(sig, sign(body, secret))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as TokenPayload;
    if (payload.role !== "owner" && payload.role !== "father") return null;
    if (typeof payload.exp !== "number" || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
