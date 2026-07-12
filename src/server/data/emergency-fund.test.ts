// @vitest-environment node
import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-emergency-fund.db";

let db: typeof import("@/server/db/prisma");
let service: typeof import("./emergency-fund");
let cashFlow: typeof import("./cash-flow");

describe("explicit emergency-fund configuration", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    db = await import("@/server/db/prisma");
    service = await import("./emergency-fund");
    cashFlow = await import("./cash-flow");
  }, 120_000);

  afterAll(async () => db.prisma.$disconnect());

  it("seeds the canonical explicit configuration and purpose", async () => {
    const dashboard = await service.getEmergencyFundConfiguration();
    expect(dashboard.configuration).toMatchObject({
      enabled: true,
      targetAmountMinor: 1_500_000,
      targetRunwayMonths: 3,
    });
    expect(dashboard.configuration.accounts[0]).toMatchObject({
      includedAmountMode: "FIXED_AMOUNT",
      fixedProtectedAmountMinor: 840_000,
    });
    expect(await db.prisma.goal.count({ where: { purpose: "EMERGENCY_FUND" } })).toBe(1);
  });

  it("updates fixed protection and target with field-level audit", async () => {
    const dashboard = await service.getEmergencyFundConfiguration();
    const accountId = dashboard.eligibleAccounts.find((account) => account.type === "SAVINGS")!.id;
    await service.updateEmergencyFundConfiguration({
      enabled: true,
      targetAmountMinor: 1_200_000,
      targetRunwayMonths: 6,
      accounts: [
        {
          accountId,
          includedAmountMode: "FIXED_AMOUNT",
          fixedProtectedAmountMinor: 700_000,
        },
      ],
    });
    const projection = await cashFlow.getCashFlowProjection(new Date("2026-07-12T00:00:00Z"));
    expect(projection.emergencyRunway).toMatchObject({
      eligibleBalanceMinor: 700_000,
      targetRunwayMonths: 6,
      meetsRunwayTarget: false,
    });
    expect(
      await db.prisma.auditLog.count({
        where: { entityType: "EmergencyFundConfiguration" },
      }),
    ).toBeGreaterThanOrEqual(3);
  });

  it("rejects liability accounts", async () => {
    const liability = await db.prisma.account.findFirstOrThrow({ where: { type: "CREDIT" } });
    await expect(
      service.updateEmergencyFundConfiguration({
        enabled: true,
        targetAmountMinor: 1_000_000,
        targetRunwayMonths: 3,
        accounts: [
          {
            accountId: liability.id,
            includedAmountMode: "ENTIRE_BALANCE",
            fixedProtectedAmountMinor: null,
          },
        ],
      }),
    ).rejects.toThrow(/active liquid account/);
  });

  it("goal renaming does not change the configured numerator", async () => {
    const before = await cashFlow.getCashFlowProjection(new Date("2026-07-12T00:00:00Z"));
    const goal = await db.prisma.goal.findFirstOrThrow({ where: { purpose: "EMERGENCY_FUND" } });
    await db.prisma.goal.update({ where: { id: goal.id }, data: { name: "Rainy Day Reserve" } });
    const after = await cashFlow.getCashFlowProjection(new Date("2026-07-12T00:00:00Z"));
    expect(after.emergencyRunway.eligibleBalanceMinor).toBe(
      before.emergencyRunway.eligibleBalanceMinor,
    );
  });
});
