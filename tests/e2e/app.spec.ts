import { expect, test } from "@playwright/test";

test("overview renders the local-first shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByText("Available Cash")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Spending by Category" })).toBeVisible();
});

test("overview action dashboard sections and links are functional", async ({ page }) => {
  await page.request.post("/api/demo-reset", { data: { confirmation: "RESET DEMO DATA" } });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Needs Your Attention" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Upcoming Obligations" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Goals Snapshot" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Debt Snapshot" })).toBeVisible();

  await page.getByRole("link", { name: "View all" }).click();
  await expect(page).toHaveURL(/\/data-quality/);
  await page.goto("/");
  await page.getByRole("link", { name: "Full breakdown" }).click();
  await expect(page).toHaveURL(/\/budget/);
  await page.goto("/");
  await page.getByRole("link", { name: "All goals" }).click();
  await expect(page).toHaveURL(/\/goals/);
  await page.goto("/");
  await page.getByRole("link", { name: "Debt planner" }).click();
  await expect(page).toHaveURL(/\/debt/);
});

test("validated cash flow explains projection, protection, timeline, and confidence", async ({
  page,
}) => {
  await page.goto("/cash-flow");
  await expect(page.getByRole("heading", { name: "Cash-Flow Timeline" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Safe to Save — Full Calculation" }),
  ).toBeVisible();
  await expect(page.getByText("Starting usable liquid cash")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Buffer and Protection" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Confidence" })).toBeVisible();
  await expect(page.getByLabel("Cash allocation reconciliation")).toContainText(
    "Cash after obligations and protections",
  );
  await expect(page.getByLabel("Cash allocation reconciliation")).toContainText(
    "Retained safety reserve",
  );
  await expect(page.getByLabel("Cash allocation reconciliation")).toContainText(
    "Allocatable surplus",
  );
  await expect(page.getByText("Retained discretionary cash")).toHaveCount(0);
  const eventList = page.locator('[tabindex="0"]').filter({ hasText: "Current usable cash" });
  await eventList.focus();
  await expect(eventList).toBeFocused();
  await page.goto("/");
  await expect(page.getByText("validated projection")).toBeVisible();
  await expect(page.getByRole("link", { name: /View calculation/ })).toHaveAttribute(
    "href",
    "/cash-flow",
  );
});

test("planning workflows add income and obligations, satisfy bills, and edit policy", async ({
  page,
}, testInfo) => {
  await page.goto("/cash-flow");
  const recommendedBefore = await page
    .getByText("Recommended Safe to Save", { exact: true })
    .locator("..")
    .textContent();
  const spendBefore = await page
    .getByText("Safe to Spend", { exact: true })
    .last()
    .locator("..")
    .textContent();
  await page.getByLabel("Income name").fill("Playwright income " + testInfo.project.name);
  await page.getByLabel("Income amount").fill("125.00");
  await page.getByLabel("Next expected date").fill("2026-07-27");
  await page.getByRole("button", { name: "Add expected income" }).click();
  await expect(page.getByText("Playwright income " + testInfo.project.name).first()).toBeVisible();
  await page.getByLabel("Obligation name").fill("Playwright bill " + testInfo.project.name);
  await page.getByLabel("Obligation amount").fill("40.00");
  await page.getByLabel("Next due date").fill("2026-07-28");
  await page.getByRole("button", { name: "Add obligation" }).click();
  await expect(page.getByText("Playwright bill " + testInfo.project.name).first()).toBeVisible();
  await page.getByRole("button", { name: "Mark paid" }).first().click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await page.getByLabel("Savings target basis points").fill("4000");
  await page.getByRole("button", { name: "Save savings policy" }).click();
  await expect(page.getByText("Saved.", { exact: true })).toBeVisible();
  await expect
    .poll(() =>
      page.getByText("Recommended Safe to Save", { exact: true }).locator("..").textContent(),
    )
    .not.toBe(recommendedBefore);
  await expect
    .poll(() => page.getByText("Safe to Spend", { exact: true }).last().locator("..").textContent())
    .not.toBe(spendBefore);
  await expect(page.getByText(/Equals Recommended at High confidence|Reduced by/)).toBeVisible();
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

test("settings tabs, privacy, and household persistence work after reload", async ({ page }) => {
  await page.goto("/settings");
  const household = page.getByLabel("Household name");
  await household.fill("Local Household");
  await page.getByRole("button", { name: "Save household" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/#privacy/);
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await expect(page.getByText("No telemetry")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Privacy" })).toBeVisible();
  await page.getByRole("button", { name: "Household" }).click();
  await expect(page.getByLabel("Household name")).toHaveValue("Local Household");
  await expect(page.getByText("Info: The calendar day")).toBeVisible();
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
  await expect(page.getByRole("button", { name: /Add Transaction/ })).toBeDisabled();
});

test("debt planner recalculates strategies, extra payments, custom order, and schedule", async ({
  page,
}) => {
  await page.request.post("/api/demo-reset", { data: { confirmation: "RESET DEMO DATA" } });
  await page.goto("/debt");
  await expect(page.getByRole("heading", { name: "Payoff strategy" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Estimated monthly schedule" })).toBeVisible();
  const initialImpact = await page
    .getByText("Estimated total interest", { exact: true })
    .locator("..")
    .textContent();
  await page.getByRole("radio", { name: /Snowball/ }).click();
  await expect(page.getByText("Temporary scenario", { exact: true })).toBeVisible();
  await page.getByLabel("Extra monthly payment").fill("500.00");
  await expect
    .poll(() =>
      page.getByText("Estimated total interest", { exact: true }).locator("..").textContent(),
    )
    .not.toBe(initialImpact);
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText("Plan saved. Cash Flow remains unchanged.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("radio", { name: /Snowball/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(page.getByLabel("Extra monthly payment")).toHaveValue("500.00");

  await page.getByRole("radio", { name: /Custom/ }).click();
  const moveButton = page.getByRole("button", { name: /^Move .* down$/ }).first();
  await moveButton.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Save plan" }).click();
  await expect(page.getByText("Plan saved. Cash Flow remains unchanged.")).toBeVisible();
  await expect(page.getByRole("table")).toBeVisible();
});

test("debt planner remains usable on mobile without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/debt");
  await expect(page.getByRole("heading", { name: "Payoff strategy" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("complete signed amount CSV import workflow and undo", async ({ page }, testInfo) => {
  const marker = `Synthetic Coffee ${testInfo.project.name}`;
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-signed-${testInfo.project.name}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(`Date,Description,Amount\n07/10/2026,${marker},-4.25\n`),
  });
  await page.getByRole("button", { name: "Preview CSV" }).click({ force: true });
  await expect(page.getByRole("heading", { name: "CSV Preview" })).toBeVisible();
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByText("Accepted")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("heading", { name: "Import Summary" })).toBeVisible();
  await expect(page.getByText("Imported", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "View imported transactions" }).click();
  await expect(page.getByRole("button", { name: marker })).toBeVisible();
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/imports/") &&
        response.url().includes("/undo") &&
        response.request().method() === "POST" &&
        response.ok(),
    ),
    page.getByRole("button", { name: "Undo import" }).first().click(),
  ]);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: marker })).toHaveCount(0);
});

test("debit credit CSV mapping imports explicit signs", async ({ page }, testInfo) => {
  const marker = `Synthetic Debit ${testInfo.project.name}`;
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-debit-credit-${testInfo.project.name}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(`Posted,Details,Debit,Credit\n11/07/2026,${marker},45.50,\n`),
  });
  await page.getByRole("button", { name: "Preview CSV" }).click({ force: true });
  await page
    .locator("label")
    .filter({ hasText: /^Date column/ })
    .getByRole("combobox")
    .selectOption("Posted");
  await page.getByLabel("Amount mode").selectOption("DEBIT_CREDIT_COLUMNS");
  await page.getByLabel("Date format").selectOption("DD/MM/YYYY");
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByText("Accepted")).toBeVisible();
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("heading", { name: "Import Summary" })).toBeVisible();
  await page.getByRole("button", { name: "View imported transactions" }).click();
  await page.getByRole("button", { name: marker }).click();
  await expect(page.getByTestId("transaction-drawer").getByText("-$45.50")).toBeVisible();
});

test("invalid row handling, duplicate review, and repeated-file warning are visible", async ({
  page,
}, testInfo) => {
  const marker = `Synthetic Repeat ${testInfo.project.name}`;
  const content = `Date,Description,Amount\n07/10/2026,${marker},-4.25\n07/11/2026,,12.345\n`;
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-repeat-${testInfo.project.name}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await page.getByRole("button", { name: "Preview CSV" }).click({ force: true });
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByText("Invalid")).toBeVisible();
  await page.getByLabel("Decision for row 1").selectOption("IMPORT");
  await page.getByRole("button", { name: "Confirm import" }).click();
  await expect(page.getByRole("heading", { name: "Import Summary" })).toBeVisible();
  await page.getByRole("button", { name: "View imported transactions" }).click();

  await page.getByRole("button", { name: "Import CSV" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: `synthetic-repeat-again-${testInfo.project.name}.csv`,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await page.getByRole("button", { name: "Preview CSV" }).click({ force: true });
  await page.getByRole("button", { name: "Validate rows" }).click();
  await expect(page.getByText(/Exact file repeat warning/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm import" })).toBeDisabled();
});

test("account creation, conditional fields, archive, and restore persist after reload", async ({
  page,
}, testInfo) => {
  const accountName = `Playwright Checking ${testInfo.project.name}`;
  await page.goto("/accounts");
  await expect(page.getByRole("heading", { name: "Add Account" })).toBeVisible();
  await page.getByRole("textbox", { name: "Name", exact: true }).fill(accountName);
  await page.getByLabel("Institution", { exact: true }).selectOption("Other institution");
  await page.getByLabel("Other institution name").fill("Test Bank");
  await expect(page.getByLabel("Available balance")).toBeVisible();
  await page.getByLabel("Type").selectOption("CREDIT");
  await expect(page.getByLabel("Credit limit")).toBeVisible();
  await expect(page.getByLabel("Available balance")).toHaveCount(0);
  await page.getByLabel("Type").selectOption("CHECKING");
  await page.getByLabel("Current balance", { exact: true }).fill("123.45");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: accountName })).toBeVisible();
  await page.getByRole("button", { name: accountName }).click();
  await expect(page.getByRole("heading", { name: "Edit Account" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel edit" }).click();
  await expect(page.getByRole("heading", { name: "Add Account" })).toBeVisible();
  const row = page.getByRole("row").filter({ hasText: accountName });
  await row.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("row").filter({ hasText: accountName }).getByText("Archived"),
  ).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: accountName })
    .getByRole("button", { name: "Restore" })
    .click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
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
  await page.getByRole("button", { name: "Categories" }).click();
  await expect(page.getByText("Info: The label used on transactions")).toBeVisible();
  await page.getByLabel("Category name").fill(categoryName);
  await page.getByLabel("Budget").fill("12.34");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator("strong", { hasText: categoryName })).toBeVisible();
  await page.getByLabel("Category name").fill("");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
});

test("settings backup creation, download, deletion, and restore flow", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Backup & Data" }).click();
  await page.getByRole("button", { name: "Create backup", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  const latestDownload = page.getByRole("link", { name: "Download" }).first();
  await expect(latestDownload).toBeVisible();

  const downloadHref = await latestDownload.getAttribute("href");
  expect(downloadHref).toBeTruthy();
  const backupResponse = await page.request.get(downloadHref!);
  expect(backupResponse.ok()).toBe(true);
  const backupBuffer = await backupResponse.body();

  await page.getByLabel("Delete backup confirmation").fill("DELETE BACKUP");
  await page.getByRole("button", { name: "Delete", exact: true }).first().click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();

  await page.getByLabel("Restore backup file").setInputFiles({
    name: "financial-compass-ui-backup.zip",
    mimeType: "application/zip",
    buffer: backupBuffer,
  });
  await page.getByRole("button", { name: "Validate restore package" }).click();
  await expect(page.getByText("Compatible backup")).toBeVisible();
  await page.getByLabel("Restore confirmation").fill("RESTORE BACKUP");
  await page.getByRole("button", { name: "Restore backup", exact: true }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
});

test("settings restore rejects invalid backup package", async ({ page }) => {
  await page.goto("/settings");
  await page.getByRole("button", { name: "Backup & Data" }).click();
  await page.getByLabel("Restore backup file").setInputFiles({
    name: "not-a-backup.zip",
    mimeType: "application/zip",
    buffer: Buffer.from("not a zip"),
  });
  await page.getByRole("button", { name: "Validate restore package" }).click();
  await expect(page.getByText("Backup archive is corrupt or unreadable.")).toBeVisible();
});

test("add/edit goal separation and contribution history persist", async ({ page }, testInfo) => {
  const goalName = `Playwright Goal ${testInfo.project.name}`;
  await page.goto("/goals");
  await expect(page.getByRole("heading", { name: "Add Goal" })).toBeVisible();
  await page.getByLabel("Goal name").fill(goalName);
  await page.getByLabel("Target").fill("500.00");
  await page.getByRole("button", { name: "Create goal" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: goalName }).click();
  await expect(page.getByRole("heading", { name: "Edit Goal" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel edit" }).click();
  await expect(page.getByRole("heading", { name: "Add Goal" })).toBeVisible();
  await page.getByRole("button", { name: "Emergency Fund" }).click();
  await page.getByLabel("Contribution goal").selectOption({ label: "Emergency Fund" });
  await page.getByLabel("Contribution amount").fill("10.00");
  await page.getByLabel("Contribution note").fill("Playwright contribution");
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/goals/") &&
        response.url().includes("/contributions") &&
        response.request().method() === "POST" &&
        response.ok(),
    ),
    page.getByRole("button", { name: "Record contribution" }).click(),
  ]);
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel("Contribution goal").selectOption({ label: "Emergency Fund" });
  await expect(page.getByText("Playwright contribution")).toBeVisible();
});

test("transaction pagination, filters, search, and URL state work", async ({ page }) => {
  await page.goto("/transactions");
  await expect(page.getByText(/Showing/)).toBeVisible();
  await page
    .getByPlaceholder("Merchant, original text, account, category, or file")
    .fill("Whole Foods");
  await expect(page).toHaveURL(/q=Whole\+Foods|q=Whole%20Foods/);
  await expect(page.getByRole("button", { name: "Whole Foods Market" })).toBeVisible();
  await page.getByLabel("Rows", { exact: true }).selectOption("50");
  await expect(page).toHaveURL(/pageSize=50/);
  await page.getByLabel("Type").selectOption("DEBIT");
  await expect(page).toHaveURL(/type=DEBIT/);
  await page.getByLabel("Status").selectOption("NEEDS_REVIEW");
  await expect(page).toHaveURL(/status=NEEDS_REVIEW/);
  await page.getByLabel("Source").selectOption("MANUAL");
  await expect(page).toHaveURL(/source=MANUAL/);
  await page.reload();
  await expect(
    page.getByPlaceholder("Merchant, original text, account, category, or file"),
  ).toHaveValue("Whole Foods");
  await expect(page.getByLabel("Rows", { exact: true })).toHaveValue("50");
  await expect(page.getByLabel("Type")).toHaveValue("DEBIT");
  await expect(page.getByLabel("Status")).toHaveValue("NEEDS_REVIEW");
  await expect(page.getByLabel("Source")).toHaveValue("MANUAL");
});

test("advanced transaction filters, history, and saved views work", async ({ page }, testInfo) => {
  await page.goto("/transactions?period=ALL");
  await page.getByRole("button", { name: /More filters/ }).click();
  await page.getByLabel("Excluded").selectOption("excluded");
  await expect(page).toHaveURL(/excluded=excluded/);
  await expect(page.getByRole("button", { name: /excluded: excluded/i })).toBeVisible();
  await page.goBack();
  await expect(page).not.toHaveURL(/excluded=excluded/);
  await page.goForward();
  await expect(page).toHaveURL(/excluded=excluded/);

  const viewName = `Playwright excluded ${testInfo.project.name}`;
  page.once("dialog", (dialog) => dialog.accept(viewName));
  await page.getByRole("button", { name: "Saved Views" }).click();
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/transaction-saved-views")),
    page.getByRole("button", { name: "Save current view" }).click(),
  ]);
  await expect(page.getByText(viewName, { exact: true })).toBeVisible();
  await page
    .getByText(viewName, { exact: true })
    .locator("../..")
    .getByRole("button", { name: "Apply", exact: true })
    .click();
  await expect(page).toHaveURL(/excluded=excluded/);
});

test("current-page selection and safe bulk review work", async ({ page }) => {
  await page.goto("/transactions?period=ALL");
  const first = page.getByRole("checkbox", { name: /Select Whole Foods Market/ });
  await first.check();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByLabel("Bulk action").selectOption("MARK_REVIEWED");
  await page.getByRole("button", { name: "Apply to selected" }).click();
  await expect(page.getByText(/Bulk action complete/)).toBeAttached();
  await page.getByRole("checkbox", { name: "Select current page" }).check();
  await expect(page.getByText(/selected/, { exact: false }).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear selection" }).click();
  await expect(page.getByLabel("Bulk action")).not.toBeVisible();
});

test("merchant rule preview and future-only save work", async ({ page }, testInfo) => {
  await page.goto("/settings#merchant-rules");
  const name = `Playwright coffee ${testInfo.project.name}`;
  await page.getByLabel("Rule name").fill(name);
  await page.getByLabel("Pattern").fill("Starbucks");
  await page.getByRole("textbox", { name: "Normalized merchant", exact: true }).fill("Coffee Shop");
  await page.getByRole("button", { name: "Test and preview" }).click();
  await expect(page.getByText(/matched/).first()).toBeVisible();
  await page.getByRole("button", { name: "Save for future only" }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Disable" }).last().click();
  await expect(page.getByText("Inactive", { exact: true }).last()).toBeVisible();
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
    page.getByRole("button", { name: "Save transaction" }).click({ force: true }),
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

test("transfer review scan, confirm, reject, manual match, and unmatch", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Desktop project owns the destructive transfer workflow.",
  );
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Scan transfers" }).click();
  await expect(page.getByText("Transfer scan complete.")).toBeAttached();
  await expect(page.getByText("Credit-card payment candidate").first()).toBeVisible();

  await page.getByRole("button", { name: "Reject suggestion" }).first().click();
  await expect(page.getByText("Transfer suggestion rejected.")).toBeAttached();

  await page.getByRole("button", { name: "Confirm transfer" }).first().click();
  await expect(page.getByText("Transfer confirmed.")).toBeAttached();
  await expect(page.getByText("Internal transfer").first()).toBeVisible();

  await page
    .getByRole("button", { name: /Online Transfer|Chase Sapphire Payment/ })
    .first()
    .click();
  await expect(page.getByText("Confirmed internal transfer")).toBeVisible();
  await page.getByRole("button", { name: "Unmatch transfer" }).click();
  await expect(page.getByText("Transfer unmatched.")).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("transaction-drawer")).toBeHidden();

  const manualOutgoing = await page.getByLabel("Manual outgoing transaction").evaluate((select) => {
    const option = [...(select as HTMLSelectElement).options].find((item) =>
      item.textContent?.includes("-$500.00"),
    );
    return option?.value ?? "";
  });
  await page.getByLabel("Manual outgoing transaction").selectOption(manualOutgoing);
  const manualIncoming = await page.getByLabel("Manual incoming transaction").evaluate((select) => {
    const option = [...(select as HTMLSelectElement).options].find(
      (item) => item.textContent?.includes("$500.00") && !item.textContent.includes("-$500.00"),
    );
    return option?.value ?? "";
  });
  await page.getByLabel("Manual incoming transaction").selectOption(manualIncoming);
  await page.getByRole("button", { name: "Create manual match" }).click();
  await expect(page.getByText("Manual transfer created.")).toBeAttached();
});

test("data quality exposes transfer review issues", async ({ page }) => {
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Scan transfers" }).click();
  await page.goto("/data-quality");
  await expect(page.getByText("High-confidence unmatched transfers")).toBeVisible();
  await expect(page.getByText("Possible credit-card payments")).toBeVisible();
});

test("recurring scan, review, confirm, reject, manual create, and savings work", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Desktop project owns the destructive recurring workflow.",
  );
  await page.goto("/recurring");
  await page.getByRole("button", { name: "Run scan" }).click();
  await expect(page.getByText(/Scan complete/)).toBeVisible();
  await expect(page.getByText("Netflix").first()).toBeVisible();
  await expect(page.getByText("Spotify").first()).toBeVisible();
  await page
    .getByRole("row")
    .filter({ hasText: "Netflix" })
    .getByRole("button", { name: "Edit" })
    .click();
  await expect(
    page.getByRole("heading", {
      name: /Netflix/,
    }),
  ).toBeVisible();
  await expect(page.getByText("Why it was detected")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Supporting transactions" })).toBeVisible();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Recurring expense updated.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm" }).first().click();
  await expect(page.getByText("Recurring item confirmed.")).toBeVisible();
  await page.getByRole("button", { name: "Reject" }).first().click();
  await expect(page.getByText("Recurring suggestion rejected.")).toBeVisible();

  const manualName = `Synthetic Membership ${testInfo.project.name}`;
  await page.getByRole("button", { name: "Create recurring item" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Display name").fill(manualName);
  await dialog.getByLabel("Service name").fill("Synthetic Service");
  await dialog.getByLabel("Merchant pattern").fill(manualName);
  await dialog.getByLabel("Typical amount").fill("12.34");
  await dialog.getByLabel("Classification").selectOption("OPTIONAL");
  await dialog.getByLabel("Recommendation").selectOption("CONSIDER_CANCELING");
  await dialog.getByLabel("Recurring type").selectOption("MEMBERSHIP");
  await dialog.getByRole("button", { name: "Create item" }).click();
  await expect(page.getByText("Manual recurring item created.")).toBeVisible();
  await page.getByLabel(`Select ${manualName} for savings`).check();
  await page.getByRole("button", { name: "Calculate selected savings" }).click();
  await expect(page.getByText("$12.34 monthly")).toBeVisible();
});

test("data quality and mobile recurring review expose recurring issues without overflow", async ({
  page,
}) => {
  await page.goto("/recurring");
  await page.getByRole("button", { name: "Run scan" }).click();
  await page.goto("/data-quality");
  await expect(page.getByText("Unconfirmed recurring candidates")).toBeVisible();
  await expect(page.getByText("Recurring price increases")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/recurring");
  await expect(page.getByRole("heading", { name: "Recurring Expenses" })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("mobile transfer review remains usable without document overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/transactions");
  await page.getByRole("button", { name: "Scan transfers" }).click();
  await expect(page.getByText("Transfer Review")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("demo reset is observable, resets canonical data, and preserves navigation preference", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Collapse navigation" }).click();
  await page.goto("/settings");
  await page.getByRole("button", { name: "Categories" }).click();
  await page.getByLabel("Category name").fill("Reset E2E Category");
  await page.getByRole("textbox", { name: /Budget/ }).fill("1.23");
  await page.getByRole("button", { name: "Add category" }).click();
  await expect(page.getByText("Saved", { exact: true })).toBeVisible();
  await expect(page.locator("strong", { hasText: "Reset E2E Category" })).toBeVisible();

  await page.getByRole("button", { name: "Backup & Data" }).click();
  await expect(page.getByText(/Type RESET DEMO DATA/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset to sample data" })).toBeDisabled();
  await page.getByLabel("Reset confirmation").fill("RESET DEMO DATA");
  await page.route("**/api/demo-reset", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.continue();
  });
  const resetResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/demo-reset") &&
      response.request().method() === "POST" &&
      response.ok(),
  );
  await page.getByRole("button", { name: "Reset to sample data" }).click();
  await expect(page.getByRole("button", { name: "Restoring..." })).toBeVisible();
  await resetResponse;
  await expect(page.getByText("Demonstration data was reset.")).toBeVisible();
  await expect(page.getByText(/1 household, 6 accounts, 14 categories/)).toBeVisible();
  await expect(page.getByLabel("Reset confirmation")).toHaveValue("");
  await page.reload();
  await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
  await page.getByRole("button", { name: "Categories" }).click();
  await expect(page.locator("strong", { hasText: "Reset E2E Category" })).toHaveCount(0);
  await expect(page.locator("strong", { hasText: "Groceries" })).toBeVisible();
});

test("demo reset surfaces server failure", async ({ page }) => {
  await page.goto("/settings#backup");
  await page.route("**/api/demo-reset", async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        code: "RESET_FAILED",
        message: "Demonstration data could not be reset.",
        details: "Simulated failure",
      }),
    });
  });
  await page.getByLabel("Reset confirmation").fill("RESET DEMO DATA");
  await page.getByRole("button", { name: "Reset to sample data" }).click();
  await expect(page.getByText("Demonstration data could not be reset.")).toBeVisible();
});

test("start fresh empties demo data, updates badges, and preserves navigation preference", async ({
  page,
}) => {
  await page.request.post("/api/demo-reset", { data: { confirmation: "RESET DEMO DATA" } });
  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByRole("status", { name: /Demonstration data/ })).toBeVisible();
    await page.getByRole("button", { name: "Collapse navigation" }).click();

    await page.goto("/settings#backup");
    await expect(page.getByRole("heading", { name: "Start fresh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start fresh" })).toBeDisabled();
    await page.getByLabel("Start fresh confirmation").fill("START FRESH");
    await page.route("**/api/workspace/start-fresh", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.continue();
    });
    const startFreshResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/workspace/start-fresh") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await page.getByRole("button", { name: "Start fresh" }).click();
    await expect(page.getByRole("button", { name: "Starting fresh..." })).toBeVisible();
    await startFreshResponse;
    await expect(page.getByText("Fresh workspace is ready.")).toBeVisible();
    await expect(page.getByLabel("Start fresh confirmation")).toHaveValue("");

    await page.goto("/");
    await expect(page.getByRole("status", { name: /Empty workspace/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your workspace is ready." })).toBeVisible();
    await page.goto("/accounts");
    await expect(page.getByRole("heading", { name: "No accounts yet." })).toBeVisible();
    await expect(page.getByText("Everyday Checking")).toHaveCount(0);
    await page.goto("/transactions");
    await expect(page.getByRole("heading", { name: "No transactions yet." })).toBeVisible();
    await expect(page.getByText("Whole Foods Market")).toHaveCount(0);
    await page.goto("/goals");
    await expect(page.getByRole("heading", { name: "No goals yet." })).toBeVisible();
    await expect(page.getByText("Emergency Fund")).toHaveCount(0);

    await page.goto("/accounts");
    await page.getByRole("textbox", { name: "Name", exact: true }).fill("Fresh Checking");
    await page.getByLabel("Institution", { exact: true }).selectOption("Other institution");
    await page.getByLabel("Other institution name").fill("Local Test Bank");
    await page.getByLabel("Current balance", { exact: true }).fill("25.00");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText("Saved", { exact: true })).toBeVisible();
    await expect(page.getByRole("status", { name: /Your data/ })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("status", { name: /Your data/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand navigation" })).toBeVisible();
  } finally {
    await page.unroute("**/api/workspace/start-fresh").catch(() => undefined);
    await page.request.post("/api/demo-reset", { data: { confirmation: "RESET DEMO DATA" } });
  }
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

test("core pages avoid horizontal overflow and metric wrapping", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "The test sets its own complete viewport matrix.",
  );
  const routes = [
    "/",
    "/transactions",
    "/cash-flow",
    "/budget",
    "/recurring",
    "/debt",
    "/goals",
    "/reports",
    "/data-quality",
    "/accounts",
    "/settings",
    "/settings#backup",
  ];
  const widths = [390, 430, 768, 1024, 1280, 1440, 1600, 1920, 2560];

  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of routes) {
      await page.goto(route);
      const layout = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        wrappedMetrics: [...document.querySelectorAll<HTMLElement>("[data-metric-value]")]
          .filter((element) => /[$%\d]/.test(element.textContent ?? ""))
          .filter(
            (element) =>
              element.getClientRects().length > 1 || element.scrollWidth > element.clientWidth,
          )
          .map((element) => element.textContent),
      }));
      expect(layout.scrollWidth, `${route} overflowed at ${width}px`).toBeLessThanOrEqual(
        layout.clientWidth,
      );
      expect(layout.wrappedMetrics, `${route} wrapped a metric at ${width}px`).toEqual([]);
    }
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
