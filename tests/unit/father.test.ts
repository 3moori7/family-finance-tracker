import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup } from "@/server/settings";
import { addFamilyExpense } from "@/server/expenses";
import { addPersonalExpense } from "@/server/personal";
import {
  changeFatherPin, checkPin, fatherAccessStatus, getFatherView, rotateFatherLink, sessionStillValid,
  setupFatherAccess, verifyViewToken,
} from "@/server/father";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "o@x.co", "a-long-password");
  await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: null });
});

describe("father link and PIN", () => {
  it("is not configured until the owner sets a PIN, which returns a one-time token", async () => {
    expect((await fatherAccessStatus(db)).configured).toBe(false);
    expect(await verifyViewToken(db, "anything")).toBeNull();
    const { token } = await setupFatherAccess(db, "1234");
    expect((await fatherAccessStatus(db)).configured).toBe(true);
    expect(await verifyViewToken(db, token)).not.toBeNull();
    expect(await verifyViewToken(db, token + "x")).toBeNull();
    const [row] = await db.query<{ view_token_hash: string; pin_hash: string }>("select view_token_hash, pin_hash from settings");
    expect(row.view_token_hash).not.toContain(token); // only a hash is stored
    expect(row.pin_hash).not.toContain("1234");
  });

  it("validates the PIN format", async () => {
    await expect(setupFatherAccess(db, "12")).rejects.toMatchObject({ code: "pinInvalid" });
    await expect(setupFatherAccess(db, "abcd")).rejects.toMatchObject({ code: "pinInvalid" });
    await expect(setupFatherAccess(db, "123456789")).rejects.toMatchObject({ code: "pinInvalid" });
  });

  it("accepts the right PIN and rejects the wrong one", async () => {
    const { token } = await setupFatherAccess(db, "4321");
    expect(await checkPin(db, token, "4321", "ip:1")).toMatchObject({ ok: true });
    expect(await checkPin(db, token, "0000", "ip:1")).toEqual({ ok: false, reason: "invalid" });
    expect(await checkPin(db, "wrong-token", "4321", "ip:1")).toEqual({ ok: false, reason: "invalid" });
  });

  it("locks out after repeated wrong PINs, even for the right one", async () => {
    const { token } = await setupFatherAccess(db, "4321");
    for (let i = 0; i < 5; i++) await checkPin(db, token, "9999", "ip:2");
    expect(await checkPin(db, token, "4321", "ip:2")).toEqual({ ok: false, reason: "locked" });
  });

  it("rotating the link kills the old link and every session", async () => {
    const { token } = await setupFatherAccess(db, "4321");
    const ok = await checkPin(db, token, "4321", "ip:3");
    if (!ok.ok) throw new Error("expected ok");
    expect(await sessionStillValid(db, ok.version)).toBe(true);
    const fresh = await rotateFatherLink(db);
    expect(await verifyViewToken(db, token)).toBeNull();
    expect(await verifyViewToken(db, fresh.token)).not.toBeNull();
    expect(await sessionStillValid(db, ok.version)).toBe(false);
    expect(await checkPin(db, fresh.token, "4321", "ip:3")).toMatchObject({ ok: true }); // same PIN
  });

  it("changing the PIN signs sessions out and old PIN stops working", async () => {
    const { token } = await setupFatherAccess(db, "4321");
    const ok = await checkPin(db, token, "4321", "ip:4");
    if (!ok.ok) throw new Error("expected ok");
    await changeFatherPin(db, "8765");
    expect(await sessionStillValid(db, ok.version)).toBe(false);
    expect(await checkPin(db, token, "4321", "ip:4")).toMatchObject({ ok: false });
    expect(await checkPin(db, token, "8765", "ip:4")).toMatchObject({ ok: true });
  });
});

describe("what the father can see", () => {
  it("exposes only totals, never itemised or personal data", async () => {
    await addFamilyExpense(db, { amount: 8000, category: "car", date: "2026-03-02", note: "SECRET-NOTE" });
    await addFamilyExpense(db, { amount: 2000, category: "home", date: "2026-03-03", note: null });
    await addPersonalExpense(db, { amount: 12345, category: "other", date: "2026-03-04", note: "PRIVATE-PURCHASE" });
    const view = await getFatherView(db, "2026-03");
    expect(view).toMatchObject({ balance: 2500000, claimTotal: 10000, claimCount: 2, reimbursed: false, cashCount: "none" });
    expect(view.breakdown).toEqual([
      { category: "car", total: 8000 },
      { category: "home", total: 2000 },
    ]);
    const json = JSON.stringify(view);
    expect(json).not.toContain("SECRET-NOTE");
    expect(json).not.toContain("PRIVATE-PURCHASE");
    expect(json).not.toContain("12345");
    expect(Object.keys(view).sort()).toEqual(
      ["balance", "breakdown", "cashCount", "claimCount", "claimTotal", "monthKey", "monthStatus", "nextKey", "prevKey", "reimbursed", "sadaqahGiven"],
    );
  });
});
