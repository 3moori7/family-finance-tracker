import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

test.describe.configure({ mode: "serial" });

async function quickAdd(page: Page, amount: string, category: string, opts: { personal?: boolean; note?: string } = {}) {
  const dialog = page.getByRole("dialog");
  // the sheet stays open after saving so another entry can follow straight away
  if (!(await dialog.isVisible())) await page.getByRole("button", { name: "Add an expense" }).click();
  if (opts.personal) await dialog.getByRole("tab", { name: "Personal" }).click();
  await dialog.getByPlaceholder("0.00").fill(amount);
  await dialog.getByText(category, { exact: true }).click();
  if (opts.note) await dialog.getByLabel("Note").fill(opts.note);
  await dialog.getByRole("button", { name: "Save", exact: true }).click();
}

test("first-run setup records the opening balance", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/setup$/);
  await page.getByLabel("Monthly salary").fill("10000");
  await page.getByLabel("Current savings balance").fill("25000");
  await page.getByLabel("Reminder email").fill("me@example.com");
  await page.getByLabel("Language").selectOption("en");
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Savings balance")).toBeVisible();
  await expect(page.getByText("25,000 SAR")).toBeVisible();
});

test("an expense can be added in four interactions, and undone", async ({ page }) => {
  await login(page);
  let interactions = 0;
  const count = <T>(p: Promise<T>) => (interactions++, p);
  await count(page.getByRole("button", { name: "Add an expense" }).click()); // 1 open
  const dialog = page.getByRole("dialog");
  await count(dialog.getByPlaceholder("0.00").fill("80")); // 2 amount
  await count(dialog.getByText("Car and fuel", { exact: true }).click()); // 3 category
  await count(dialog.getByRole("button", { name: "Save", exact: true }).click()); // 4 save
  expect(interactions).toBe(4);
  await expect(page.getByText("Expense saved")).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await dialog.getByRole("button", { name: "Done" }).click();
  await page.goto("/expenses");
  await expect(page.getByText("No expenses this month")).toBeVisible();
});

test("expenses add up, can be edited and deleted", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await quickAdd(page, "80", "Car and fuel");
  await expect(page.getByText("Expense saved")).toBeVisible();
  await quickAdd(page, "120", "Groceries", { note: "NOTE-SECRET-ITEM" });
  await expect(page.getByText("Expense saved").first()).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();

  await page.goto("/expenses");
  await expect(page.getByText("200 SAR").first()).toBeVisible();
  await page.getByRole("link", { name: /80 SAR/ }).click();
  await page.getByLabel("Amount").fill("90");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page).toHaveURL(/\/expenses\?m=/);
  await expect(page.getByText("210 SAR").first()).toBeVisible();

  // add and delete a throwaway entry
  await quickAdd(page, "5", "Other");
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByText("215 SAR").first()).toBeVisible();
  await page.getByRole("link", { name: /5 SAR/ }).first().click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).last().click();
  await expect(page).toHaveURL(/\/expenses\?m=/);
  await expect(page.getByText("210 SAR").first()).toBeVisible();
});

test("personal spending is optional and shows an estimate", async ({ page }) => {
  await login(page);
  await page.goto("/personal");
  await expect(page.getByText("2,500 SAR").first()).toBeVisible(); // 25% of 10,000 before logging anything
  await quickAdd(page, "50", "Other", { personal: true });
  await expect(page.getByText("Expense saved")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.reload();
  await expect(page.getByText("2,450 SAR").first()).toBeVisible();
  await expect(page.getByText("estimate", { exact: false }).first()).toBeVisible();
});

test("the month-end routine, from salary to a locked month", async ({ page }) => {
  await login(page);
  await page.goto("/month");
  await expect(page.getByText("0/5").or(page.getByText("1/5"))).toBeVisible();

  // 1 salary and 2 deposit
  await page.getByRole("button", { name: "Confirm salary" }).click();
  await expect(page.getByText("Salary confirmed").first()).toBeVisible();
  await expect(page.getByText("7,500 SAR").first()).toBeVisible();
  await page.getByRole("button", { name: "I handed it over" }).click();
  await expect(page.getByText("Deposit recorded")).toBeVisible();
  // 3 sadaqah
  await page.getByRole("button", { name: "Dad gave it out" }).click();
  await expect(page.getByText("Given out", { exact: true }).first()).toBeVisible();
  // 4 reimbursement of 210
  await page.getByRole("button", { name: "Dad paid the full amount" }).click();
  await page.getByRole("button", { name: "Confirm: received 210 SAR" }).click();
  await expect(page.getByText("Settled").first()).toBeVisible();

  // closing is not possible yet
  await expect(page.getByRole("button", { name: "Close the month" })).toBeDisabled();

  // 5 cash count: 25,000 + 7,250 = 32,250 expected, Dad counts 32,200
  await expect(page.getByText("32,250 SAR").first()).toBeVisible();
  await page.getByLabel("Amount counted").fill("32200");
  await page.getByRole("button", { name: "Compare" }).click();
  await expect(page.getByText("Short by 50 SAR")).toBeVisible();
  await page.getByLabel("Reason for the difference").fill("Dad lent 50 to the neighbour");
  await page.getByRole("button", { name: "Record a correction" }).click();
  await expect(page.getByText("The count matches ✓")).toBeVisible();

  // 6 close
  await expect(page.getByText("5/5")).toBeVisible();
  await page.getByRole("button", { name: "Close the month" }).click();
  await page.getByRole("button", { name: "Confirm closing" }).click();
  await expect(page.getByText("The month is closed")).toBeVisible();
  await expect(page.getByText("This month is closed and read-only")).toBeVisible();
});

test("a closed month rejects new expenses and edits", async ({ page }) => {
  await login(page);
  await page.goto("/");
  await quickAdd(page, "10", "Other");
  await expect(page.getByRole("dialog").getByText("closed")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Done" }).click();
  await page.goto("/expenses");
  await expect(page.getByText("This month is reimbursed", { exact: false })).toBeVisible();
  // items are no longer links
  await expect(page.getByRole("link", { name: /90 SAR/ })).toHaveCount(0);
});

test("the savings screen shows the balance after the correction", async ({ page }) => {
  await login(page);
  await page.goto("/savings");
  await expect(page.getByText("32,200 SAR").first()).toBeVisible();
  await expect(page.getByText("Dad lent 50 to the neighbour")).toBeVisible();
  // withdrawals above the balance are refused
  await page.getByText("Withdraw from savings").click();
  await page.getByLabel("Amount", { exact: true }).fill("99999");
  await page.getByLabel("Reason for withdrawal").fill("Too much");
  await page.getByRole("button", { name: "Record withdrawal" }).click();
  await expect(page.getByText("more than the savings balance")).toBeVisible();
});

test("the statement matches the data and can be saved as a PDF", async ({ page }, info) => {
  await login(page);
  await page.goto("/statements");
  await page.getByRole("link", { name: /Closed/ }).click();
  await expect(page.getByText("Statement for")).toBeVisible();
  await expect(page.getByText("32,200 SAR").first()).toBeVisible();
  await expect(page.getByText("210 SAR").first()).toBeVisible();
  const pdfPath = info.outputPath("statement.pdf");
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: pdfPath, format: "A4" });
  const bytes = fs.readFileSync(pdfPath);
  expect(bytes.subarray(0, 4).toString()).toBe("%PDF");
  expect(bytes.length).toBeGreaterThan(5_000);
  fs.mkdirSync("test-results", { recursive: true });
  fs.copyFileSync(pdfPath, "test-results/statement.pdf");

  // the same statement in Arabic (right-to-left, embedded Arabic font)
  await page.emulateMedia({ media: "screen" });
  await page.context().addCookies([{ name: "ff_locale", value: "ar", url: "http://localhost:3100" }]);
  await page.reload();
  await expect(page.getByText("كشف شهر")).toBeVisible();
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: "test-results/statement-ar.pdf", format: "A4" });
  expect(fs.statSync("test-results/statement-ar.pdf").size).toBeGreaterThan(5_000);
});

test("export downloads work and contain the data", async ({ page }) => {
  await login(page);
  const sheet = await page.request.get("/api/export");
  expect(sheet.status()).toBe(200);
  expect(sheet.headers()["content-type"]).toContain("spreadsheetml");
  const json = await page.request.get("/api/export?format=json");
  const dump = await json.json();
  expect(dump.tables.family_expenses).toHaveLength(2);
  expect(JSON.stringify(dump)).not.toContain("scrypt$");
});

test("activity log shows every change in plain language", async ({ page }) => {
  await login(page);
  await page.goto("/more/activity");
  await expect(page.getByText("Month closed").first()).toBeVisible();
  await expect(page.getByText("Correction").first()).toBeVisible();
  await page.getByLabel("Type").selectOption("family_expenses");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page.getByText("Family expense · Added").first()).toBeVisible();
});

test("the interface is right-to-left in Arabic", async ({ page }) => {
  await login(page);
  await page.context().addCookies([{ name: "ff_locale", value: "ar", url: "http://localhost:3100" }]);
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("link", { name: "الرئيسية" })).toBeVisible();
  // no horizontal scrolling on a phone
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
