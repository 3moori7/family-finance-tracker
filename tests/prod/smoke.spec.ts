import { expect, test } from "@playwright/test";

test("owner pages redirect visitors to the login page", async ({ page }) => {
  for (const path of ["/", "/month", "/more/export", "/setup"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("the login page loads over HTTPS in Arabic by default", async ({ page, baseURL }) => {
  expect(baseURL).toMatch(/^https:\/\//);
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("button", { name: "دخول" })).toBeVisible();
});

test("data endpoints refuse anonymous callers", async ({ request }) => {
  expect([307, 308, 401]).toContain((await request.get("/api/export", { maxRedirects: 0 })).status());
  expect((await request.get("/api/cron/backup")).status()).toBe(401);
  expect((await request.get("/api/cron/reminders")).status()).toBe(401);
});

test("security headers, robots and the manifest are in place", async ({ request }) => {
  const h = (await request.get("/login")).headers();
  expect(h["referrer-policy"]).toBe("no-referrer");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  expect((await request.get("/manifest.webmanifest")).status()).toBe(200);
});

test("an unknown father link is a plain 404", async ({ page }) => {
  const res = await page.goto("/view/not-a-real-token");
  expect(res?.status()).toBe(404);
});
