import { expect, test } from "@playwright/test";

// Runs last: five wrong passwords lock this address out of signing in for 15 minutes.
test.describe("login lockout", () => {
  test("wrong passwords are rejected and repeated tries are locked out", async ({ page }) => {
    await page.context().addCookies([{ name: "ff_locale", value: "en", url: "http://localhost:3100" }]);
    await page.goto("/login");
    for (let i = 0; i < 5; i++) {
      await page.getByLabel("Email").fill("owner@example.com");
      await page.getByLabel("Password").fill("wrong-password");
      await Promise.all([
        page.waitForResponse((r) => r.request().method() === "POST" && r.url().endsWith("/login")),
        page.getByRole("button", { name: "Sign in" }).click(),
      ]);
      await expect(page.getByText("Wrong email or password")).toBeVisible();
    }
    await page.getByLabel("Email").fill("owner@example.com");
    await page.getByLabel("Password").fill("e2e-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Too many attempts")).toBeVisible();
  });
});
