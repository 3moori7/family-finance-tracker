import { expect, type Page } from "@playwright/test";

export const OWNER = { email: "owner@example.com", password: "e2e-password-123" };

/** English UI makes assertions readable; Arabic is covered by its own test. */
export async function setEnglish(page: Page) {
  await page.context().addCookies([{ name: "ff_locale", value: "en", url: "http://localhost:3100" }]);
}

export async function login(page: Page) {
  await setEnglish(page);
  await page.goto("/login");
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/login/);
}
