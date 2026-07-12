// @vitest-environment node
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-cash-flow.db";
let prismaModule: typeof import("@/server/db/prisma");
let service: typeof import("./cash-flow");

describe("cash-flow repository projection", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    prismaModule = await import("@/server/db/prisma");
    service = await import("./cash-flow");
  }, 120000);
  afterAll(async () => prismaModule.prisma.$disconnect());

  it("uses six reconciled demo ledgers and repository obligations", async () => {
    const projection = await service.getCashFlowProjection(new Date("2026-07-12T00:00:00Z"));
    expect(
      await prismaModule.prisma.account.count({ where: { reconciliationDifferenceMinor: 0 } }),
    ).toBe(6);
    expect(projection.startingUsableLiquidCashMinor).toBeGreaterThan(0);
    expect(projection.debtMinimumPaymentsMinor).toBeGreaterThan(0);
    expect(projection.calculationLines).toHaveLength(8);
    expect(projection.emergencyRunway).toMatchObject({
      eligibleBalanceMinor: 840_000,
      essentialMonthlyMinor: 255_000,
      runwayBasisPoints: 32_941,
      confidence: "HIGH",
    });
    expect(projection.emergencyRunway.obligations.map((item) => item.label)).not.toContain(
      "Northstar Payroll",
    );
    const overview = service.cashAllocationSummary(projection);
    expect(overview.recommendedSafeToSaveMinor).toBe(projection.recommendedSafeToSaveMinor);
    expect(overview.safeToSpendMinor).toBe(projection.safeToSpendMinor);
    expect(overview.allocatableSurplusMinor).toBe(projection.allocatableSurplusMinor);
  });

  it("lowers confidence for unreconciled and mixed repository data", async () => {
    const account = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    await prismaModule.prisma.account.update({
      where: { id: account.id },
      data: { reconciliationStatus: "UNRECONCILED", reconciliationDifferenceMinor: 700 },
    });
    await prismaModule.prisma.household.updateMany({ data: { workspaceMode: "MIXED" } });
    const projection = await service.getCashFlowProjection(new Date("2026-07-12T00:00:00Z"));
    expect(projection.confidence).toBe("MODERATE");
    expect(projection.dataQualityReserveMinor).toBeGreaterThanOrEqual(700);
    expect(projection.workspaceWarning).toMatch(/Mixed/);
  });
});
