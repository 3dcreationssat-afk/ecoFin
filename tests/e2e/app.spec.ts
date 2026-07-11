import { expect, test } from "@playwright/test";

test("overview renders the local-first shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Safe to Save")).toBeVisible();
});

test("transactions drawer opens from a transaction row", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Whole Foods Market" }).click();
  await expect(page.getByTestId("transaction-drawer")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Whole Foods Market" })).toBeVisible();
  await expect(page.getByText("Imported Data")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("transaction-drawer")).toBeHidden();
});

test("settings persist in browser local storage after reload", async ({ page }) => {
  await page.goto("/settings");
  const household = page.getByLabel("Household name");
  await household.fill("Audit Household");
  await page.reload();
  await expect(page.getByLabel("Household name")).toHaveValue("Audit Household");
  await expect(page.getByText("These settings persist in this browser")).toBeVisible();
});

test("mobile navigation reaches accounts", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Accounts" }).click();
  await expect(page.getByRole("heading", { name: "Accounts", exact: true })).toBeVisible();
});

test("planned controls are disabled instead of silently inert", async ({ page }) => {
  await page.goto("/reports");
  await expect(page.getByRole("button", { name: /CSV/ })).toBeDisabled();
  await page.goto("/accounts");
  await expect(page.getByRole("button", { name: /Add Account/ })).toBeDisabled();
});

test("desktop navigation collapse preference persists", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
});
