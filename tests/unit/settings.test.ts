import { beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/db/test-utils";
import type { Db } from "@/db/types";
import { upsertOwner } from "@/server/owner";
import { completeSetup, getSettings, updateSettings } from "@/server/settings";
import { AppError, toErrorCode } from "@/server/errors";
import { isoDate, money, percent } from "@/server/parse";

let db: Db;
beforeEach(async () => {
  db = await createTestDb();
  await upsertOwner(db, "Owner@Example.com", "a-long-password");
});

describe("owner", () => {
  it("stores a lowercase email and a hash, not the password", async () => {
    const s = await getSettings(db);
    expect(s?.ownerEmail).toBe("owner@example.com");
    const [row] = await db.query<{ owner_password_hash: string }>("select owner_password_hash from settings");
    expect(row.owner_password_hash).not.toContain("a-long-password");
  });
});

describe("setup wizard", () => {
  it("saves settings and creates the opening ledger entry", async () => {
    await completeSetup(db, { salaryAmount: 1000000, openingBalance: 2500000, language: "ar", reminderEmail: "x@y.co" });
    const s = await getSettings(db);
    expect(s).toMatchObject({ salaryAmount: 1000000, setupCompleted: true, reminderEmail: "x@y.co" });
    const rows = await db.query<{ type: string; amount: number }>("select type, amount from ledger_entries");
    expect(rows).toEqual([{ type: "opening", amount: 2500000 }]);
  });
  it("cannot run twice", async () => {
    const input = { salaryAmount: 1, openingBalance: 0, language: "en" as const, reminderEmail: null };
    await completeSetup(db, input);
    await expect(completeSetup(db, input)).rejects.toMatchObject({ code: "alreadyDone" });
  });
  it("rejects negative amounts", async () => {
    await expect(
      completeSetup(db, { salaryAmount: -5, openingBalance: 0, language: "ar", reminderEmail: null }),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("settings update", () => {
  it("validates percentages", async () => {
    const base = { salaryAmount: 1, language: "ar" as const, reminderEmail: null, remindersEnabled: true };
    await expect(updateSettings(db, { ...base, splitPercent: 101, sadaqahPercent: 1 })).rejects.toMatchObject({ code: "percentInvalid" });
    await expect(updateSettings(db, { ...base, splitPercent: 50, sadaqahPercent: 60 })).rejects.toMatchObject({ code: "percentInvalid" });
    await updateSettings(db, { ...base, splitPercent: 80, sadaqahPercent: 2.5 });
    expect((await getSettings(db))?.splitPercent).toBe(80);
  });
});

describe("input parsing and error mapping", () => {
  it("parses money, dates and percents", () => {
    expect(money("12.5", "amount")).toBe(1250);
    expect(money("-5", "adj", { signed: true })).toBe(-500);
    expect(() => money("0", "amount")).toThrow();
    expect(money("0", "amount", { allowZero: true })).toBe(0);
    expect(() => money("", "amount")).toThrow();
    expect(isoDate("2026-02-28")).toBe("2026-02-28");
    expect(() => isoDate("2026-02-30")).toThrow();
    expect(percent("2.5", "p")).toBe(2.5);
    expect(() => percent("120", "p")).toThrow();
  });
  it("maps database rule errors to codes", () => {
    expect(toErrorCode(new Error("insufficient_balance")).code).toBe("insufficient_balance");
    expect(toErrorCode(new Error("error: month_closed (P0001)")).code).toBe("month_closed");
  });
});
