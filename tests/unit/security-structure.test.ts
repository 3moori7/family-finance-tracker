import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(SRC);
const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
const read = (p: string) => fs.readFileSync(p, "utf8");

/** Split a "use server" file into its exported async functions. */
function exportedFunctions(src: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = [];
  const re = /export async function (\w+)\s*\(/g;
  let m: RegExpExecArray | null;
  const starts: { name: string; idx: number }[] = [];
  while ((m = re.exec(src))) starts.push({ name: m[1], idx: m.index });
  starts.forEach((s, i) => out.push({ name: s.name, body: src.slice(s.idx, starts[i + 1]?.idx ?? src.length) }));
  return out;
}

// Actions that are intentionally callable without an owner session.
const PUBLIC_ACTIONS: Record<string, string[]> = {
  "app/actions/locale.ts": ["setLocale"],
  "app/login/actions.ts": ["login", "logout"],
  "app/view/[token]/actions.ts": ["submitPin", "exitView"],
};

describe("every server action is protected", () => {
  const actionFiles = files.filter((f) => /actions\.ts$/.test(f) && read(f).includes('"use server"'));

  it("found the action files", () => {
    expect(actionFiles.length).toBeGreaterThanOrEqual(8);
  });

  for (const f of actionFiles) {
    it(`${rel(f)}: owner actions call requireOwner() first`, () => {
      const allowed = PUBLIC_ACTIONS[rel(f)] ?? [];
      const fns = exportedFunctions(read(f));
      expect(fns.length).toBeGreaterThan(0);
      for (const fn of fns) {
        if (allowed.includes(fn.name)) continue;
        // requireOwner must appear before any database access in the function
        // either guard directly, or delegate to the shared act() helper (checked in the next test)
        if (fn.body.includes("return act(")) continue;
        const guard = fn.body.indexOf("requireOwner()");
        const firstDb = fn.body.search(/getDb\(\)/);
        expect(guard, `${fn.name} must call requireOwner()`).toBeGreaterThan(-1);
        if (firstDb > -1) expect(guard).toBeLessThan(firstDb);
      }
    });
  }

  it("the shared month-action helper requires the owner", () => {
    const src = read(path.join(SRC, "app/(owner)/month/actions.ts"));
    const act = src.slice(src.indexOf("async function act("), src.indexOf("export async function saveSalaryAction"));
    expect(act).toContain("requireOwner()");
  });
});

describe("pages and routes", () => {
  it("every page lives in a guarded area", () => {
    const pages = files.filter((f) => /\/page\.tsx$/.test(f)).map(rel);
    for (const p of pages) {
      const ok = p.startsWith("app/(owner)/") || p === "app/login/page.tsx" || p === "app/setup/page.tsx" || p.startsWith("app/view/");
      expect(ok, `${p} is not under a guarded area`).toBe(true);
    }
  });

  it("every owner page checks the session itself (pages render alongside their layout)", () => {
    const pages = files.filter((f) => /app\/\(owner\)\/.*page\.tsx$/.test(f.split(path.sep).join("/")));
    expect(pages.length).toBeGreaterThanOrEqual(12);
    for (const f of pages) expect(read(f), rel(f)).toContain("await requireOwner()");
  });

  it("the owner layout and setup page require the owner", () => {
    expect(read(path.join(SRC, "app/(owner)/layout.tsx"))).toContain("requireOwner()");
    expect(read(path.join(SRC, "app/setup/page.tsx"))).toContain("requireOwner()");
  });

  it("father pages verify the link token and the session before showing data", () => {
    for (const f of files.filter((f) => rel(f).startsWith("app/view/") && f.endsWith("page.tsx"))) {
      const src = read(f);
      expect(src, rel(f)).toContain("verifyViewToken");
      expect(src, rel(f)).toContain("getFatherSession");
      expect(src, rel(f)).toContain("sessionStillValid");
    }
  });

  it("father code can only reach the father-safe services", () => {
    const allowed = new Set(["father", "session", "activity", "env", "client-ip"]); // (PinForm only imports an action from app/view)
    const fatherFiles = [
      ...files.filter((f) => rel(f).startsWith("app/view/")),
      ...files.filter((f) => rel(f) === "components/father/PinForm.tsx" || rel(f).startsWith("components/activity/")),
    ];
    for (const f of fatherFiles) {
      for (const m of read(f).matchAll(/from "@\/server\/([\w-]+)"/g)) {
        expect(allowed.has(m[1]), `${rel(f)} imports @/server/${m[1]}`).toBe(true);
      }
    }
    // the shared activity view must be told which audience it serves
    expect(read(path.join(SRC, "app/view/[token]/activity/page.tsx"))).toContain('audience="father"');
    expect(read(path.join(SRC, "app/(owner)/more/activity/page.tsx"))).toContain('audience="owner"');
  });

  it("the data routes check who is calling", () => {
    expect(read(path.join(SRC, "app/api/export/route.ts"))).toContain("isOwner()");
    for (const r of ["backup", "reminders"]) {
      expect(read(path.join(SRC, `app/api/cron/${r}/route.ts`))).toContain("authorizeCron(request)");
    }
  });

  it("session cookies are HTTP-only and the proxy keeps owner pages behind a cookie", () => {
    const session = read(path.join(SRC, "server/session.ts"));
    expect(session).toContain("httpOnly: true");
    expect(session).toContain('sameSite: "lax"');
    const proxy = read(path.join(SRC, "proxy.ts"));
    expect(proxy).toContain("ff_owner");
  });
});
