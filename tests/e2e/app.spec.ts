import { expect, test } from "@playwright/test";

test("overview renders the local-first shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Net Worth")).toBeVisible();
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

test("settings persist through sqlite after reload", async ({ page }) => {
  await page.goto("/settings");
  const household = page.getByLabel("Household name");
  await household.fill("SQLite Household");
  await page.getByRole("button", { name: "Save household" }).click();
  await expect(page.getByText("Saved to SQLite")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Household name")).toHaveValue("SQLite Household");
  await expect(page.getByText("SQLite is the source of truth")).toBeVisible();
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
  await page.goto("/transactions");
  await expect(page.getByRole("button", { name: /Import CSV/ })).toBeDisabled();
});

test("account creation, archive, and restore persist after reload", async ({ page }, testInfo) => {
  const accountName = `Playwright Checking ${testInfo.project.name}`;
  await page.goto("/accounts");
  await page.getByLabel("Name").fill(accountName);
  await page.getByLabel("Institution").fill("Test Bank");
  await page.getByLabel("Balance").fill("123.45");
  await page.getByRole("button", { name: "Create as new" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: accountName })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: accountName });
  await row.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: accountName }).getByText("Archived"),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: accountName })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: accountName }).getByText("Active"),
  ).toBeVisible();
});

test("category creation persists and validation errors are accessible", async ({
  page,
}, testInfo) => {
  const categoryName = `Playwright Category ${testInfo.project.name}`;
  await page.goto("/settings");
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByLabel("Budget").fill("12.34");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Saved to SQLite")).toBeVisible();
  await page.reload();
  await expect(page.locator("strong", { hasText: categoryName })).toBeVisible();
  await page.getByLabel("Category name").fill("");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("goal contribution persists with traceable history", async ({ page }) => {
  await page.goto("/goals");
  await page.getByRole("button", { name: "Emergency Fund" }).click();
  await page.getByLabel("Contribution amount").fill("10.00");
  await page.getByRole("button", { name: "Record contribution" }).click();
  await expect(page.getByText("Saved")).toBeVisible();
  await page.reload();
  await expect(page.getByText(/contribution records/).first()).toBeVisible();
});

test("transaction drawer edit persists and original values remain unchanged", async ({ page }) => {
  await page.goto("/transactions");
  await page
    .getByRole("button", { name: /Whole Foods/ })
    .first()
    .click();
  const drawer = page.getByTestId("transaction-drawer");
  await expect(page.getByText("Original description")).toBeVisible();
  await expect(drawer.getByText("WHOLE FOODS MARKET #123")).toBeVisible();
  await page.getByLabel("Merchant").fill("Whole Foods Edited");
  await page.getByLabel("Notes").fill("Playwright normalized note");
  await page.getByLabel("Exclude from summaries").check();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/transactions/") &&
        response.request().method() === "PATCH" &&
        response.ok(),
    ),
    page.getByRole("button", { name: "Save transaction" }).click(),
  ]);
  await page.keyboard.press("Escape");
  await page.reload();
  await page.getByRole("button", { name: "Whole Foods Edited" }).click();
  await expect(
    page.getByTestId("transaction-drawer").getByText("WHOLE FOODS MARKET #123"),
  ).toBeVisible();
  await expect(
    page.getByTestId("transaction-drawer").getByText(/Whole Foods.*Whole Foods Edited/),
  ).toBeVisible();
});

test("demo reset requires confirmation and preserves navigation preference", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await page.getByLabel("Reset confirmation").fill("RESET DEMO DATA");
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await expect(page.getByText("Saved to SQLite")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
});

test("desktop navigation collapse preference persists", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
});

test("desktop navigation expands after being collapsed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.getByRole("button", { name: "Expand navigation" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Collapse navigation" })).toBeVisible();
  await expect(page.getByText("Financial Compass")).toBeVisible();
});

test("collapsed desktop navigation keeps active state, labels, tooltips, and local indicator", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/reports");
  await page.getByRole("button", { name: "Collapse navigation" }).click();

  await expect(page.getByRole("link", { name: "Reports" })).toHaveAttribute("aria-current", "page");
  await page.getByRole("link", { name: "Reports" }).hover();
  await expect(page.getByRole("tooltip", { name: "Reports" })).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Local data stored on this device" }),
  ).toBeVisible();
});

test("mobile drawer closes with escape and returns focus", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("mobile-nav")).toBeHidden();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
});

test("tablet drawer uses backdrop close without permanent rail", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("desktop-sidebar")).toBeHidden();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await expect(page.getByTestId("mobile-nav")).toBeVisible();
  await page.getByTestId("mobile-nav-backdrop").click({ position: { x: 760, y: 20 } });
  await expect(page.getByTestId("mobile-nav")).toBeHidden();
});

test("shell avoids horizontal overflow at representative widths", async ({ page }) => {
  for (const width of [1440, 1280, 1024, 768, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  }
});

test("navigation honors reduced motion preference", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const duration = await page.getByTestId("desktop-sidebar").evaluate((element) => {
    return window.getComputedStyle(element).transitionDuration;
  });
  const durationMs = duration.endsWith("ms")
    ? Number.parseFloat(duration)
    : Number.parseFloat(duration) * 1000;
  expect(durationMs).toBeLessThanOrEqual(0.01);
});
