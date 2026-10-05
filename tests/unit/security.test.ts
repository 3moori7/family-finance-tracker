import { describe, expect, it } from "vitest";
import { hashSecret, signSession, verifySecret, verifySession } from "@/lib/security";
import { createTestDb } from "@/db/test-utils";
import { clearFailures, isLocked, recordFailure } from "@/server/rate-limit";

describe("passwords", () => {
  it("verifies the right secret and rejects wrong ones", () => {
    const h = hashSecret("correct horse");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(verifySecret("correct horse", h)).toBe(true);
    expect(verifySecret("wrong", h)).toBe(false);
    expect(verifySecret("anything", null)).toBe(false);
    expect(verifySecret("anything", "garbage")).toBe(false);
  });
  it("salts every hash", () => {
    expect(hashSecret("same")).not.toBe(hashSecret("same"));
  });
});

describe("session tokens", () => {
  const secret = "s3cret";
  const now = 1_000_000;
  it("round-trips a valid token", () => {
    const t = signSession({ role: "owner", exp: now + 100 }, secret);
    expect(verifySession(t, secret, now)).toMatchObject({ role: "owner" });
  });
  it("rejects tampered, expired and wrong-secret tokens", () => {
    const t = signSession({ role: "father", exp: now + 100, v: 1 }, secret);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ role: "owner", exp: now + 100 })).toString("base64url");
    expect(verifySession(`${forged}.${sig}`, secret, now)).toBeNull();
    expect(verifySession(`${body}.x`, secret, now)).toBeNull();
    expect(verifySession(t, "other", now)).toBeNull();
    expect(verifySession(t, secret, now + 1000)).toBeNull();
    expect(verifySession(undefined, secret, now)).toBeNull();
  });
});

describe("rate limiting", () => {
  it("locks after 5 failures and unlocks when cleared", async () => {
    const db = await createTestDb();
    for (let i = 0; i < 4; i++) await recordFailure(db, "x");
    expect(await isLocked(db, "x")).toBe(false);
    await recordFailure(db, "x");
    expect(await isLocked(db, "x")).toBe(true);
    expect(await isLocked(db, "y")).toBe(false);
    await clearFailures(db, "x");
    expect(await isLocked(db, "x")).toBe(false);
  });
});
