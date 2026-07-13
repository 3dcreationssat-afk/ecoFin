// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-import-reimport.db";

let imports: typeof import("./imports");
let reimport: typeof import("./import-reimport");
let repositories: typeof import("./repositories");
let prismaModule: typeof import("@/server/db/prisma");

describe("verified import reimport", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    imports = await import("./imports");
    reimport = await import("./import-reimport");
    repositories = await import("./repositories");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => prismaModule.prisma.$disconnect());

  it("preserves historical rows and safe user intent while leaving ambiguous semantics flagged", async () => {
    const dashboard = await imports.importDashboard();
    const account = dashboard.accounts.find((item) => item.type === "CHECKING")!;
    const category = dashboard.categories.find((item) => item.type === "EXPENSE")!;
    const content = [
      "Date,Description,Amount",
      "07/10/2026,Synthetic ordinary purchase,12.50",
      "07/11/2026,Synthetic payment adjustment,25.00",
    ].join("\n");
    const validate = () =>
      imports.validateImport({
        accountId: account.id,
        filename: "synthetic-reimport.csv",
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
          dateColumn: "Date",
          descriptionColumn: "Description",
          amountMode: "SIGNED_AMOUNT",
          amountColumn: "Amount",
          dateFormat: "MM/DD/YYYY",
          decimalSeparator: ".",
          thousandsSeparator: "",
          signConvention: "DEBITS_POSITIVE",
          currency: "USD",
        },
      });
    const firstValidated = await validate();
    const first = await imports.confirmImport({
      batchId: firstValidated.id,
      decisions: firstValidated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    const ordinary = first.transactions.find((item) => item.sourceRowNumber === 1)!;
    await repositories.updateTransactionEditable(ordinary.id, {
      normalizedMerchant: ordinary.normalizedMerchant,
      categoryId: category.id,
      type: ordinary.type,
      reviewStatus: "REVIEWED",
      excluded: false,
      notes: null,
    });
    const snapshots = reimport.editableSnapshots(
      await prismaModule.prisma.transaction.findMany({ where: { importBatchId: first.id } }),
    );
    await reimport.verifiedUndoForReimport({
      batchId: first.id,
      expectedFileHash: first.fileHash,
      expectedAccountId: account.id,
      expectedTransactionCount: 2,
      expectedAccountClass: "ASSET",
    });
    expect(await prismaModule.prisma.importRow.count({ where: { importBatchId: first.id } })).toBe(
      2,
    );
    expect(
      await prismaModule.prisma.transaction.count({ where: { importBatchId: first.id } }),
    ).toBe(0);
    const secondValidated = await validate();
    const second = await imports.confirmImport({
      batchId: secondValidated.id,
      decisions: secondValidated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
      confirm: "IMPORT CSV",
    });
    await reimport.carryForwardEditableIntent(second.id, snapshots);
    await reimport.linkReplacementBatch(first.id, second.id);
    const replacements = await prismaModule.prisma.transaction.findMany({
      where: { importBatchId: second.id },
      orderBy: { sourceRowNumber: "asc" },
    });
    expect(replacements[0]).toMatchObject({
      amountMinor: -1250,
      categoryId: category.id,
      reviewStatus: "REVIEWED",
    });
    expect(replacements[1]).toMatchObject({
      amountMinor: -2500,
      type: "UNKNOWN",
      reviewStatus: "FLAGGED",
      typeSource: "IMPORT_REPAIR_REVIEW",
    });
    const mapping = JSON.parse(second.summaryJson ?? "{}").mapping;
    expect(mapping).toMatchObject({
      amountMode: "SIGNED_AMOUNT",
      signConvention: "DEBITS_POSITIVE",
    });
    expect(
      await prismaModule.prisma.importBatch.findUniqueOrThrow({ where: { id: first.id } }),
    ).toMatchObject({ status: "UNDONE" });
  });
});
