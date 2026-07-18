import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-import.db";

let imports: typeof import("./imports");
let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");
let merchantRules: typeof import("./merchant-rules");
let accountBalances: typeof import("./account-balances");
let transactionBulk: typeof import("./transaction-bulk");

const signedCsv =
  "Date,Description,Amount\n07/10/2026,Synthetic Coffee,-4.25\n07/11/2026,Synthetic Payroll,1250.00";
const debitCreditCsv =
  "Posted;Details;Debit;Credit\n11/07/2026;Synthetic Grocery;45,50;\n12/07/2026;Synthetic Refund;;12,25";
const invalidCsv = "Date,Description,Amount\n07/10/2026,,not-money";

describe("csv import repositories", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-import.db" },
    });
    imports = await import("./imports");
    repositories = await import("./repositories");
    prismaModule = await import("@/server/db/prisma");
    merchantRules = await import("./merchant-rules");
    accountBalances = await import("./account-balances");
    transactionBulk = await import("./transaction-bulk");
  }, 120_000);

  afterAll(async () => {
    await prismaModule?.prisma.$disconnect();
  });

  it("creates, edits, and archives reusable import profiles", async () => {
    const household = await repositories.getHousehold();
    const profile = await imports.createImportProfile({
      householdId: household.id,
      name: "Integration Signed Profile",
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      dateColumn: "Date",
      descriptionColumn: "Description",
      amountMode: "SIGNED_AMOUNT",
      amountColumn: "Amount",
      dateFormat: "MM/DD/YYYY",
      decimalSeparator: ".",
      thousandsSeparator: ",",
      signConvention: "DEBITS_NEGATIVE",
      currency: "USD",
    });
    expect(profile.id).toBeTruthy();
    const updated = await imports.updateImportProfile(profile.id, {
      ...profile,
      name: "Updated Profile",
    });
    expect(updated.name).toBe("Updated Profile");
    expect((await imports.setImportProfileArchived(profile.id, true)).archivedAt).toBeTruthy();
  });

  it("previews a CSV above the former 1000-row limit", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const rows = Array.from(
      { length: 1500 },
      (_, index) => `07/10/2026,Synthetic transaction ${index.toString().padStart(4, "0")},-4.25`,
    );
    const content = `Date,Description,Amount\n${rows.join("\n")}`;

    const preview = await imports.previewImport({
      accountId: account.id,
      filename: "synthetic-large.csv",
      fileSize: Buffer.byteLength(content, "utf8"),
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
    });

    expect(preview.status).toBe("PREVIEW");
    expect(preview.rows).toHaveLength(1500);
  });

  it("returns an actionable validation error when a CSV exceeds 10000 rows", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const rows = Array.from({ length: 10_001 }, (_, index) => `7/1/26,S${index},-1`);
    const content = `Date,Description,Amount\n${rows.join("\n")}`;

    await expect(
      imports.previewImport({
        accountId: account.id,
        filename: "synthetic-too-many-rows.csv",
        fileSize: Buffer.byteLength(content, "utf8"),
        content,
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
      }),
    ).rejects.toMatchObject({
      message: "CSV exceeds the 10000 row limit.",
      status: 422,
    });
  });

  it("previews, validates, imports, detects repeats, and undoes signed amount CSV", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const ledgerBefore = (await accountBalances.recalculateAccountBalance(account.id))
      .ledgerBalanceMinor;
    await merchantRules.createMerchantRule(
      {
        name: "Synthetic coffee import",
        priority: 1,
        active: true,
        matchField: "ORIGINAL_DESCRIPTION",
        matchType: "CONTAINS",
        pattern: "synthetic coffee",
        normalizedMerchant: "Rule Coffee",
        categoryId: null,
        transactionType: "EXPENSE",
        markReviewed: true,
        notes: "integration",
      },
      false,
    );
    const preview = await imports.previewImport({
      accountId: account.id,
      filename: "synthetic-signed.csv",
      fileSize: signedCsv.length,
      content: signedCsv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
    });
    expect(preview.status).toBe("PREVIEW");
    expect(preview.rows).toHaveLength(2);

    const validated = await imports.validateImport({
      batchId: preview.id,
      accountId: account.id,
      filename: "synthetic-signed.csv",
      fileSize: signedCsv.length,
      content: signedCsv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        merchantColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    expect(validated.acceptedRowCount).toBe(2);
    expect(
      validated.rows.flatMap((row) => JSON.parse(row.validationErrorsJson) as string[]),
    ).not.toContain("Ambiguous slash date; explicit format was applied.");
    expect(JSON.parse(validated.summaryJson ?? "{}").mapping).toMatchObject({
      amountMode: "SIGNED_AMOUNT",
      signConvention: "DEBITS_NEGATIVE",
    });
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      allowRepeatedFile: false,
      confirm: "IMPORT CSV",
    });
    expect(imported.importedTransactionCount).toBe(2);
    const created = await prismaModule.prisma.transaction.findMany({
      where: { importBatchId: imported.id },
      orderBy: { sourceRowNumber: "asc" },
    });
    expect(created[0].originalDescription).toBe("Synthetic Coffee");
    expect(created[0].normalizedMerchant).toBe("Rule Coffee");
    expect(created[0].type).toBe("EXPENSE");
    expect(created[0].reviewStatus).toBe("REVIEWED");
    expect(created[0].merchantSource).toBe("MERCHANT_RULE");
    const importedLedgerMovement = created
      .filter(
        (transaction) =>
          transaction.affectsLedger &&
          transaction.clearingStatus === "CLEARED" &&
          !transaction.possibleDuplicate,
      )
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0);
    expect(
      (await prismaModule.prisma.account.findUnique({ where: { id: account.id } }))
        ?.ledgerBalanceMinor,
    ).toBe((ledgerBefore ?? 0) + importedLedgerMovement);
    expect(created[0].originalAmountText).toBe("-4.25");
    expect(created[0].sourceType).toBe("CSV_IMPORT");
    const audits = await prismaModule.prisma.auditLog.findMany({
      where: { entityType: "ImportBatch", entityId: imported.id },
    });
    expect(audits.some((audit) => audit.action === "confirm")).toBe(true);
    const derivedRule = await prismaModule.prisma.forecastRule.create({
      data: {
        householdId: account.householdId,
        accountId: account.id,
        name: "Synthetic import-derived forecast",
        merchantKey: `synthetic-import-${imported.id}`,
        direction: "INCOME",
        cadence: "MONTHLY",
        anchorDate: new Date("2026-07-11T00:00:00.000Z"),
        lastObservedDate: new Date("2026-07-11T00:00:00.000Z"),
        nextExpectedDate: new Date("2026-08-11T00:00:00.000Z"),
        typicalAmountMinor: 125000,
        minAmountMinor: 125000,
        maxAmountMinor: 125000,
        confidence: "LOW",
        confidenceScore: 40,
        state: "DETECTED",
        provenance: "Created from this synthetic import.",
        creationSource: "DETECTED",
        effectiveStartDate: new Date("2026-07-11T00:00:00.000Z"),
        reasonsJson: "[]",
        detectionFingerprint: `synthetic-import-${imported.id}`,
      },
    });
    await prismaModule.prisma.importBatch.update({
      where: { id: imported.id },
      data: {
        summaryJson: JSON.stringify({
          ...(JSON.parse(imported.summaryJson ?? "{}") as Record<string, unknown>),
          forecastCreatedRuleIds: [derivedRule.id],
        }),
      },
    });

    const repeat = await imports.previewImport({
      accountId: account.id,
      filename: "synthetic-signed.csv",
      fileSize: signedCsv.length,
      content: signedCsv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
    });
    expect(repeat.repeatedFile).toBe(true);

    const undone = await imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" });
    expect(undone.status).toBe("UNDONE");
    expect(
      (await prismaModule.prisma.account.findUnique({ where: { id: account.id } }))
        ?.ledgerBalanceMinor,
    ).toBe(ledgerBefore);
    expect(
      await prismaModule.prisma.transaction.count({ where: { importBatchId: imported.id } }),
    ).toBe(0);
    expect(
      await prismaModule.prisma.forecastRule.findUnique({ where: { id: derivedRule.id } }),
    ).toBeNull();
    expect(
      await prismaModule.prisma.auditLog.findFirst({
        where: {
          entityType: "ImportBatch",
          entityId: imported.id,
          action: "derived_detection_recomputed_after_undo",
        },
      }),
    ).toBeTruthy();
  });

  it("discards review-only changes explicitly before a protected web undo", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const content = "Date,Description,Amount\n07/12/2026,Synthetic review-only undo,-8.75";
    const validated = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-review-only-undo.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    await transactionBulk.bulkUpdateTransactions({
      transactionIds: imported.transactions.map((transaction) => transaction.id),
      action: "MARK_REVIEWED",
    });

    await expect(
      imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" }),
    ).rejects.toMatchObject({
      status: 409,
      issues: [{ path: "recovery", message: "DISCARD_REVIEW_CHANGES" }],
    });

    await expect(
      imports.discardReviewChangesForUndo(imported.id, {
        confirm: "DISCARD REVIEW CHANGES",
      }),
    ).resolves.toEqual({ discardedReviewChanges: 1 });
    expect(
      await prismaModule.prisma.transaction.findFirstOrThrow({
        where: { importBatchId: imported.id },
        select: { reviewStatus: true, reviewSource: true },
      }),
    ).toEqual({ reviewStatus: "NEEDS_REVIEW", reviewSource: "IMPORT_DEFAULT" });
    expect(
      await prismaModule.prisma.auditLog.count({
        where: {
          entityType: "ImportBatch",
          entityId: imported.id,
          action: "review_changes_discarded_for_undo",
        },
      }),
    ).toBe(1);

    const undone = await imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" });
    expect(undone.status).toBe("UNDONE");
    expect(
      await prismaModule.prisma.transaction.count({ where: { importBatchId: imported.id } }),
    ).toBe(0);
  });

  it("imports a positive Apple Card ACH transfer as a debt payment without an ambiguity warning", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts.find((item) => item.type === "CREDIT")!;
    const content = [
      "Transaction Date,Description,Type,Amount (USD)",
      '07/12/2026,"ACH DEPOSIT INTERNET TRANSFER FROM ACCOUNT ENDING IN 0143",Payment,-89.15',
    ].join("\n");
    const validated = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-apple-card.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        saveProfile: false,
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Transaction Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount (USD)",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_POSITIVE",
        currency: "USD",
      },
    });
    expect(validated.rows[0]).toMatchObject({
      parsedAmountMinor: 8915,
      validationStatus: "VALID",
      validationErrorsJson: "[]",
    });
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: [{ rowId: validated.rows[0].id, decision: "IMPORT" }],
      confirm: "IMPORT CSV",
    });
    expect(imported.transactions[0]).toMatchObject({
      amountMinor: 8915,
      type: "CREDIT_CARD_PAYMENT",
      typeSource: "IMPORT_ACCOUNT_CONTEXT",
      affectsIncomeSpendingReports: false,
      reviewStatus: "NEEDS_REVIEW",
    });
  });

  it("requires an explicit Import or Skip decision for every duplicate candidate", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const content =
      "Date,Description,Amount\n07/10/2026,Synthetic repeated charge,-4.25\n07/10/2026,Synthetic repeated charge,-4.25";
    const preview = await imports.previewImport({
      accountId: account.id,
      filename: "synthetic-duplicate-candidates.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
    });
    const validated = await imports.validateImport({
      batchId: preview.id,
      accountId: account.id,
      filename: "synthetic-duplicate-candidates.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    const candidate = validated.rows.find((row) => row.duplicateStatus !== "NONE");
    expect(candidate?.importDecision).toBe("REVIEW");

    await expect(
      imports.confirmImport({
        batchId: validated.id,
        decisions: validated.rows.map((row) => ({
          rowId: row.id,
          decision: row.id === candidate?.id ? "REVIEW" : "IMPORT",
        })),
        confirm: "IMPORT CSV",
      }),
    ).rejects.toThrow(/Choose Import or Skip.*Unresolved rows: 2/);

    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({
        rowId: row.id,
        decision: "IMPORT",
      })),
      confirm: "IMPORT CSV",
    });
    expect(imported.importedTransactionCount).toBe(2);
    const explicitDuplicate = imported.transactions.find(
      (transaction) => transaction.importRowId === candidate?.id,
    );
    expect(explicitDuplicate).toMatchObject({ possibleDuplicate: true, affectsLedger: true });

    const overlapContent = 'Date,Description,Amount\n07/10/2026,Synthetic repeated charge,"-4.25"';
    const overlap = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-overlapping-range.csv",
      fileSize: overlapContent.length,
      content: overlapContent,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    expect(overlap.rows[0]).toMatchObject({
      duplicateStatus: "EXACT_OVERLAP",
      importDecision: "SKIP",
    });

    const unchanged = await imports.confirmImport({
      batchId: overlap.id,
      decisions: [],
      confirm: "IMPORT CSV",
    });
    expect(unchanged).toMatchObject({
      status: "NO_CHANGES",
      importedTransactionCount: 0,
    });
    expect(JSON.parse(unchanged.summaryJson ?? "{}")).toMatchObject({
      skippedCount: 1,
      exactOverlapSkippedCount: 1,
    });
    expect(
      await prismaModule.prisma.transaction.count({
        where: {
          accountId: account.id,
          transactionDate: new Date("2026-07-10T00:00:00.000Z"),
          amountMinor: -425,
          originalDescription: "Synthetic repeated charge",
        },
      }),
    ).toBe(2);

    const excessContent = [
      "Date,Description,Amount",
      "07/10/2026,Synthetic repeated charge,-4.25",
      "07/10/2026,Synthetic repeated charge,-4.25",
      "07/10/2026,Synthetic repeated charge,-4.25",
    ].join("\n");
    const excess = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-overlap-with-extra.csv",
      fileSize: excessContent.length,
      content: excessContent,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    expect(excess.rows.map((row) => row.importDecision)).toEqual(["SKIP", "SKIP", "REVIEW"]);
    await expect(
      imports.confirmImport({
        batchId: excess.id,
        decisions: [],
        confirm: "IMPORT CSV",
      }),
    ).rejects.toThrow(/Unresolved rows: 3/);
  });

  it("accepts Amex-shaped rows with masked account identifiers and preserves unused metadata", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const headers = [
      "Date",
      "Description",
      "Card Member",
      "Account #",
      "Amount",
      "Extended Details",
      "Appears On Your Statement As",
      "Address",
      "City/State",
      "Zip Code",
      "Country",
      "Reference",
      "Category",
    ];
    const examples = [
      ["AplPay ALIMENTACION MADRID ES", "6.88", "'320261740038905040"],
      ["AplPay FARMACIA HERNMADRID ES", "22.29", "'320261740038905041"],
      ["AplPay HM LA GAVIA EMADRID ES", "51.88", "'320261740038905042"],
      ["AplPay UNHCR DEN HAAG NL", "1.15", "'320261740038905043"],
      ["FOREIGN TRANSACTION FEE 1", "0.03", "'820261740019432634"],
      ["FOREIGN TRANSACTION FEE 2", "0.18", "'820261740019432635"],
      ["FOREIGN TRANSACTION FEE 3", "0.60", "'820261740019432636"],
      ["FOREIGN TRANSACTION FEE 4", "1.40", "'820261740019432637"],
    ];
    const rows = Array.from({ length: 28 }, (_, index) => {
      const example = examples[index] ?? [
        `Synthetic Amex purchase ${index}`,
        `${index + 1}.15`,
        `'9${index}`,
      ];
      const ignoredValue = ["-92002", "+12345", "=1+1", "@SUM(1;2)"][index % 4];
      return [
        "06/23/2026",
        example[0],
        "SYNTHETIC CARD MEMBER",
        "-92002",
        example[1],
        ignoredValue,
        example[0],
        "",
        "",
        "",
        "SPAIN",
        example[2],
        "Synthetic category",
      ].join(",");
    });
    const content = `${headers.join(",")}\n${rows.join("\n")}`;
    const preview = await imports.previewImport({
      accountId: account.id,
      filename: "synthetic-amex.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
    });
    const validated = await imports.validateImport({
      batchId: preview.id,
      accountId: account.id,
      filename: "synthetic-amex.csv",
      fileSize: content.length,
      content,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });

    expect(validated).toMatchObject({
      acceptedRowCount: 28,
      rejectedRowCount: 0,
      duplicateCandidateCount: 0,
    });
    expect(validated.rows.map((row) => row.parsedAmountMinor).slice(0, 8)).toEqual([
      688, 2229, 5188, 115, 3, 18, 60, 140,
    ]);
    const firstSource = JSON.parse(validated.rows[0].sourceFieldsJson) as Record<string, string>;
    expect(firstSource["Account #"]).toBe("-92002");
    expect(firstSource.Reference).toBe("'320261740038905040");

    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    expect(imported.importedTransactionCount).toBe(28);
    expect(imported.transactions.every((transaction) => transaction.accountId === account.id)).toBe(
      true,
    );
  });

  it("imports debit and credit column CSV with explicit sign convention", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[1];
    const validated = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-debit-credit.csv",
      fileSize: debitCreditCsv.length,
      content: debitCreditCsv,
      delimiter: ";",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ";",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Posted",
        descriptionColumn: "Details",
        merchantColumn: "Details",
        amountMode: "DEBIT_CREDIT_COLUMNS",
        debitColumn: "Debit",
        creditColumn: "Credit",
        dateFormat: "DD/MM/YYYY",
        decimalSeparator: ",",
        thousandsSeparator: ".",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    expect(validated.acceptedRowCount).toBe(2);
    const imported = await imports.confirmImport({
      batchId: validated.id,
      decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    const amounts = await prismaModule.prisma.transaction.findMany({
      where: { importBatchId: imported.id },
      orderBy: { sourceRowNumber: "asc" },
    });
    expect(amounts.map((transaction) => transaction.amountMinor)).toEqual([-4550, 1225]);
  });

  it("keeps invalid rows out and blocks undo after material edits", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts[0];
    const validated = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-invalid.csv",
      fileSize: invalidCsv.length,
      content: invalidCsv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    expect(validated.rejectedRowCount).toBe(1);
    await expect(
      imports.confirmImport({
        batchId: validated.id,
        decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
        confirm: "IMPORT CSV",
      }),
    ).rejects.toThrow(/No valid rows/);

    const valid = await imports.validateImport({
      accountId: account.id,
      filename: "synthetic-edit-block.csv",
      fileSize: signedCsv.length,
      content: signedCsv,
      delimiter: ",",
      encoding: "UTF-8",
      hasHeader: true,
      mapping: {
        delimiter: ",",
        encoding: "UTF-8",
        hasHeader: true,
        dateColumn: "Date",
        descriptionColumn: "Description",
        amountMode: "SIGNED_AMOUNT",
        amountColumn: "Amount",
        dateFormat: "MM/DD/YYYY",
        decimalSeparator: ".",
        thousandsSeparator: ",",
        signConvention: "DEBITS_NEGATIVE",
        currency: "USD",
        saveProfile: false,
      },
    });
    const imported = await imports.confirmImport({
      batchId: valid.id,
      decisions: valid.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      allowRepeatedFile: true,
      confirm: "IMPORT CSV",
    });
    const edited = await prismaModule.prisma.transaction.findFirstOrThrow({
      where: { importBatchId: imported.id },
    });
    await repositories.updateTransactionEditable(edited.id, {
      normalizedMerchant: "Edited Imported Merchant",
      categoryId: null,
      type: edited.type,
      reviewStatus: "REVIEWED",
      excluded: false,
      notes: "edited",
    });
    await expect(imports.undoImportBatch(imported.id, { confirm: "UNDO IMPORT" })).rejects.toThrow(
      /materially edited/,
    );
  });
});
