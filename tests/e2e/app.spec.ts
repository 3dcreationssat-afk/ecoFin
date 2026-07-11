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
