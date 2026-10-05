import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

// Phone-layout audit: every main screen, in both languages, at the two common phone widths.
const WIDTHS = [360, 390];
const LOCALES = ["ar", "en"] as const;
const OWNER_PAGES = [
  "/", "/expenses", "/savings", "/month", "/personal", "/statements", "/more", "/more/settings",
  "/more/father", "/more/activity", "/more/export",
];

async function audit(page: Page, label: string) {
  // 1. nothing sticks out sideways
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  // 2. every control is a comfortable tap target (an older user must be able to hit it)
  const small = await page.evaluate(() => {
    const out: string[] = [];
    const els = document.querySelectorAll<HTMLElement>("button, a[href], input:not([type=hidden]):not([type=radio]):not([type=checkbox]), select, textarea, summary");
    for (const el of els) {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || style.visibility === "hidden" || el.closest("[hidden]")) continue;
      if (el.closest("#__next-route-announcer__") || el.tagName === "NEXTJS-PORTAL") continue;
      if (r.height < 40) out.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    return out;
  });
  expect(small, `${label}: controls smaller than 40px`).toEqual([]);
}

for (const width of WIDTHS) {
  for (const locale of LOCALES) {
    test(`owner screens fit a ${width}px phone in ${locale}`, async ({ page }) => {
      await login(page);
      await page.context().addCookies([{ name: "ff_locale", value: locale, url: "http://localhost:3100" }]);
      await page.setViewportSize({ width, height: 800 });
      for (const path of OWNER_PAGES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await audit(page, `${path} @${width} ${locale}`);
      }
      // the quick-add sheet too
      await page.goto("/");
      await page.getByRole("button", { name: locale === "ar" ? "أضف مصروفًا" : "Add an expense" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await audit(page, `quick add @${width} ${locale}`);
    });
  }
}

test("Dad's screens fit a phone and use large text", async ({ page, browser }) => {
  await login(page);
  await page.goto("/more/father");
  await page.getByRole("button", { name: "New link" }).click();
  const link = await page.locator("input[readonly]").inputValue();

  for (const locale of LOCALES) {
    const ctx = await browser.newContext({ viewport: { width: 360, height: 800 } });
    await ctx.addCookies([{ name: "ff_locale", value: locale, url: "http://localhost:3100" }]);
    const dad = await ctx.newPage();
    await dad.goto(link);
    await audit(dad, `PIN screen ${locale}`);
    await dad.getByLabel(locale === "ar" ? "الرمز" : "PIN").fill("2468");
    await dad.keyboard.press("Enter");
    await expect(dad.getByText(locale === "ar" ? "رصيد المدخرات" : "Savings balance")).toBeVisible();
    await audit(dad, `Dad home ${locale}`);
    // the balance is the biggest thing on the page and at least 32px
    const size = await dad.locator("main .text-4xl").first().evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(32);
    await dad.goto(`${link}/activity`);
    await audit(dad, `Dad log ${locale}`);
    await ctx.close();
  }
});
