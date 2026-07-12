import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-import.db";

let imports: typeof import("./imports");
let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");
let merchantRules: typeof import("./merchant-rules");

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
    const ledgerBefore = account.ledgerBalanceMinor;
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
        decision: row.id === candidate?.id ? "SKIP" : "IMPORT",
      })),
      confirm: "IMPORT CSV",
    });
    expect(imported.importedTransactionCount).toBe(1);
    expect(imported.rows.find((row) => row.id === candidate?.id)?.createdTransactionId).toBeNull();
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
