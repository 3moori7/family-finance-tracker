import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

function keys(o: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === "object" ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe("translations", () => {
  it("Arabic and English have identical keys", () => {
    expect(keys(ar).sort()).toEqual(keys(en).sort());
  });
  it("no empty strings", () => {
    for (const k of [...keys(ar), ...keys(en)]) expect(k).toBeTruthy();
    const flat = (o: Record<string, unknown>): string[] =>
      Object.values(o).flatMap((v) => (typeof v === "object" ? flat(v as Record<string, unknown>) : [String(v)]));
    for (const s of [...flat(ar), ...flat(en)]) expect(s.trim().length).toBeGreaterThan(0);
  });
});
