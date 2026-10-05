import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

let link = "";

test("the owner turns on Dad's access and gets a one-time link", async ({ page }) => {
  await login(page);
  await page.goto("/more/father");
  await page.getByLabel("PIN (4 to 8 digits)").fill("12");
  await page.getByRole("button", { name: "Turn on access and create the link" }).click();
  // the browser's own pattern check blocks a 2-digit PIN, so the form never submits
  await page.getByLabel("PIN (4 to 8 digits)").fill("2468");
  await page.getByRole("button", { name: "Turn on access and create the link" }).click();
  const field = page.locator("input[readonly]");
  await expect(field).toBeVisible();
  link = await field.inputValue();
  expect(link).toMatch(/\/view\/[\w-]{20,}$/);
  // the link is not shown again after a reload
  await page.reload();
  await expect(page.locator("input[readonly]")).toHaveCount(0);
});

test("Dad needs the PIN, then sees only totals", async ({ browser }) => {
  const ctx = await browser.newContext({ locale: "en-US" });
  await ctx.addCookies([{ name: "ff_locale", value: "en", url: "http://localhost:3100" }]);
  const page = await ctx.newPage();
  await page.goto(link);
  await expect(page.getByText("Enter the PIN")).toBeVisible();
  await expect(page.getByText("Savings balance")).toHaveCount(0);

  await page.getByLabel("PIN").fill("0000");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Wrong PIN")).toBeVisible();

  await page.getByLabel("PIN").fill("2468");
  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByText("Savings balance")).toBeVisible();
  await expect(page.getByText("32,200 SAR")).toBeVisible();
  await expect(page.getByText("210 SAR").first()).toBeVisible();
  await expect(page.getByText("Settled").first()).toBeVisible();
  await expect(page.getByText("Groceries")).toBeVisible(); // category totals are fine

  const html = await page.content();
  expect(html).not.toContain("NOTE-SECRET-ITEM"); // no itemised notes
  expect(html).not.toContain("2,450"); // nothing from the personal tracker
  await expect(page.getByRole("button", { name: /Add|Save|Confirm|Delete/ })).toHaveCount(0); // read-only

  // the change history is readable but not itemised
  await page.getByRole("link", { name: "Change history" }).click();
  await expect(page.getByText("Month closed").first()).toBeVisible();
  // the raw HTML also carries the translation catalogue (labels only), so compare what is visible
  expect(await page.content()).not.toContain("NOTE-SECRET-ITEM");
  const visible = await page.locator("main").innerText();
  expect(visible).not.toContain("NOTE-SECRET-ITEM");
  expect(visible).not.toContain("Family expense ·");
  expect(visible).not.toContain("Personal expense ·");
  expect(visible).not.toContain("Settings ·");
  expect(visible).toContain("Savings · Added"); // savings movements are shown

  // owner pages stay out of reach
  for (const p of ["/", "/month", "/personal", "/expenses", "/api/export?format=json"]) {
    const res = await page.request.get(p, { maxRedirects: 0 });
    expect([301, 302, 303, 307, 308, 401]).toContain(res.status());
  }
  await ctx.close();
});

test("rotating the link signs Dad out and kills the old link", async ({ page, browser }) => {
  const dad = await browser.newContext({ locale: "en-US" });
  await dad.addCookies([{ name: "ff_locale", value: "en", url: "http://localhost:3100" }]);
  const dadPage = await dad.newPage();
  await dadPage.goto(link);
  await dadPage.getByLabel("PIN").fill("2468");
  await dadPage.getByRole("button", { name: "Open" }).click();
  await expect(dadPage.getByText("Savings balance")).toBeVisible();

  await login(page);
  await page.goto("/more/father");
  await page.getByRole("button", { name: "New link" }).click();
  const fresh = await page.locator("input[readonly]").inputValue();
  expect(fresh).not.toBe(link);

  expect((await dadPage.goto(link))?.status()).toBe(404); // old link is gone
  await dadPage.goto(fresh);
  await expect(dadPage.getByText("Enter the PIN")).toBeVisible(); // old session no longer works
  await dad.close();
});
