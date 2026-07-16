import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-forecast-rules.db";

let service: typeof import("./forecast-rules");
let cashFlow: typeof import("./cash-flow");
let repositories: typeof import("./repositories");
let imports: typeof import("./imports");
let prismaModule: typeof import("@/server/db/prisma");

describe("forecast rule persistence and matching", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-forecast-rules.db" },
    });
    service = await import("./forecast-rules");
    cashFlow = await import("./cash-flow");
    repositories = await import("./repositories");
    imports = await import("./imports");
    prismaModule = await import("@/server/db/prisma");
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("detects, confirms, projects, matches, skips, pauses, and resumes payroll idempotently", async () => {
    const household = await repositories.getHousehold();
    const account = household.accounts.find((item) => item.type === "CHECKING")!;
    const dates = ["2026-05-22", "2026-06-05", "2026-06-19", "2026-07-03"];
    const historical = await importCsv(
      account.id,
      "euronet-history.csv",
      dates.map((date, index) => `${date},EURONET PAYROLL,${index === 2 ? "2441.00" : "2425.00"}`),
    );
    expect(JSON.parse(historical.summaryJson ?? "{}").payrollPatternsDetected).toBe(1);

    const firstScan = await service.detectForecastRules(
      household.id,
      new Date("2026-07-15T00:00:00.000Z"),
    );
    expect(firstScan.createdCount).toBe(0);
    const secondScan = await service.detectForecastRules(
      household.id,
      new Date("2026-07-15T00:00:00.000Z"),
    );
    expect(secondScan).toMatchObject({ createdCount: 0, refreshedCount: 0 });

    const rule = await prismaModule.prisma.forecastRule.findFirstOrThrow({
      where: { householdId: household.id, merchantKey: "euronet" },
    });
    expect(rule).toMatchObject({ cadence: "BIWEEKLY", state: "DETECTED", confidence: "HIGH" });
    await service.actOnForecastRule(rule.id, { action: "CONFIRM" });

    const projected = await cashFlow.getCashFlowProjection(new Date("2026-07-15T00:00:00.000Z"));
    expect(
      projected.events
        .filter((event) => event.ruleId === rule.id)
        .map((event) => event.date.toISOString().slice(0, 10)),
    ).toEqual(["2026-07-17", "2026-07-31"]);

    const nextPaycheck = await importCsv(account.id, "euronet-next.csv", [
      "2026-07-17,EURONET PAYROLL DIRECT DEPOSIT,2430.00",
    ]);
    expect(JSON.parse(nextPaycheck.summaryJson ?? "{}").forecastOccurrencesMatched).toBe(1);
    const posted = await prismaModule.prisma.transaction.findFirstOrThrow({
      where: { importBatchId: nextPaycheck.id },
    });
    expect(
      (
        await service.matchForecastOccurrences({
          householdId: household.id,
          transactionIds: [posted.id],
        })
      ).createdCount,
    ).toBe(0);
    expect(
      await prismaModule.prisma.forecastOccurrence.count({
        where: { ruleId: rule.id, status: "MATCHED", matchedTransactionId: posted.id },
      }),
    ).toBe(1);
    expect(
      (
        await service.matchForecastOccurrences({
          householdId: household.id,
          transactionIds: [posted.id],
        })
      ).createdCount,
    ).toBe(0);

    const afterMatch = await cashFlow.getCashFlowProjection(new Date("2026-07-18T00:00:00.000Z"));
    expect(afterMatch.events.filter((event) => event.ruleId === rule.id)).toHaveLength(1);
    expect(
      afterMatch.events
        .find((event) => event.ruleId === rule.id)
        ?.date.toISOString()
        .slice(0, 10),
    ).toBe("2026-07-31");

    await service.actOnForecastOccurrence({
      ruleId: rule.id,
      expectedDate: "2026-07-31",
      action: "SKIP",
    });
    const afterSkip = await cashFlow.getCashFlowProjection(new Date("2026-07-18T00:00:00.000Z"));
    expect(afterSkip.events.filter((event) => event.ruleId === rule.id)).toHaveLength(0);

    await service.actOnForecastRule(rule.id, { action: "PAUSE" });
    await service.detectForecastRules(household.id, new Date("2026-07-15T00:00:00.000Z"));
    expect(
      (await prismaModule.prisma.forecastRule.findUniqueOrThrow({ where: { id: rule.id } })).state,
    ).toBe("PAUSED");
    await service.actOnForecastRule(rule.id, { action: "RESUME" });
    expect(
      (await prismaModule.prisma.forecastRule.findUniqueOrThrow({ where: { id: rule.id } })).state,
    ).toBe("CONFIRMED");
    await imports.undoImportBatch(nextPaycheck.id, { confirm: "UNDO IMPORT" });
    expect(
      await prismaModule.prisma.forecastOccurrence.count({
        where: { matchedTransactionId: posted.id },
      }),
    ).toBe(0);
    const audits = await prismaModule.prisma.auditLog.findMany({
      where: { entityType: { in: ["ForecastRule", "ForecastOccurrence"] } },
    });
    expect(audits.some((audit) => audit.action === "payroll_pattern_detected")).toBe(true);
    expect(audits.some((audit) => audit.action === "transaction_auto_matched")).toBe(true);
    expect(audits.some((audit) => audit.action === "occurrence_skip")).toBe(true);
    expect(audits.some((audit) => audit.action === "automatic_match_removed")).toBe(true);
  });
});

async function importCsv(accountId: string, filename: string, rows: string[]) {
  const content = `Date,Description,Amount\n${rows.join("\n")}`;
  const preview = await imports.previewImport({
    accountId,
    filename,
    fileSize: Buffer.byteLength(content),
    content,
    delimiter: ",",
    encoding: "UTF-8",
    hasHeader: true,
  });
  const validated = await imports.validateImport({
    batchId: preview.id,
    accountId,
    filename,
    fileSize: Buffer.byteLength(content),
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
      merchantColumn: "Description",
      amountMode: "SIGNED_AMOUNT",
      amountColumn: "Amount",
      dateFormat: "YYYY-MM-DD",
      decimalSeparator: ".",
      thousandsSeparator: ",",
      signConvention: "DEBITS_NEGATIVE",
      currency: "USD",
      saveProfile: false,
    },
  });
  return imports.confirmImport({
    batchId: validated.id,
    decisions: validated.rows.map((row) => ({ rowId: row.id, decision: "IMPORT" })),
    allowRepeatedFile: false,
    confirm: "IMPORT CSV",
  });
}
