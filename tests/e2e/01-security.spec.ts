import { expect, test } from "@playwright/test";

test.describe("not signed in", () => {
  for (const path of ["/", "/month", "/expenses", "/savings", "/personal", "/statements", "/more", "/more/settings", "/more/activity", "/more/father", "/more/export", "/setup"]) {
    test(`${path} sends visitors to the login page`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test("data downloads and cron endpoints refuse anonymous callers", async ({ request }) => {
    expect((await request.get("/api/export", { maxRedirects: 0 })).status()).toBeGreaterThanOrEqual(301);
    expect((await request.get("/api/export?format=json", { headers: { cookie: "ff_owner=forged.value" }, maxRedirects: 0 })).status()).toBe(401);
    expect((await request.get("/api/cron/backup")).status()).toBe(401);
    expect((await request.get("/api/cron/reminders")).status()).toBe(401);
    expect((await request.get("/api/cron/backup", { headers: { authorization: "Bearer wrong" } })).status()).toBe(401);
  });

  test("a forged owner cookie does not work", async ({ page }) => {
    await page.context().addCookies([{ name: "ff_owner", value: "eyJyb2xlIjoib3duZXIiLCJleHAiOjk5OTk5OTk5OTl9.forged", url: "http://localhost:3100" }]);
    await page.goto("/month");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an unknown father link looks like a missing page", async ({ page }) => {
    const res = await page.goto("/view/not-a-real-token");
    expect(res?.status()).toBe(404);
  });

  test("security headers are set and the site is not indexable", async ({ request }) => {
    const res = await request.get("/login");
    const h = res.headers();
    expect(h["referrer-policy"]).toBe("no-referrer");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  });

  test("the app is installable: manifest, icons and service worker are public", async ({ request }) => {
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.display).toBe("standalone");
    expect(manifest.lang).toBe("ar");
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));
    for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
    const sw = await request.get("/sw.js");
    expect(sw.status()).toBe(200);
    expect(await sw.text()).toContain("offline");
    expect((await request.get("/offline.html")).status()).toBe(200);
  });
});
