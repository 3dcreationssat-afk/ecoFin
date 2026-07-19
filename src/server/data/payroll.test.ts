// @vitest-environment node

import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.DATABASE_URL = "file:./vitest-payroll.db";
process.env.FINANCIAL_COMPASS_PROJECT_ROOT = process.cwd();
process.env.FINANCIAL_COMPASS_WORKSPACE_TYPE = "TEST";

let payroll: typeof import("./payroll");
let prismaModule: typeof import("@/server/db/prisma");

describe("payroll dashboard", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: "file:./vitest-payroll.db" },
    });
    prismaModule = await import("@/server/db/prisma");
    payroll = await import("./payroll");
  }, 120_000);

  afterAll(async () => prismaModule?.prisma.$disconnect());

  it("ties normalized payroll metrics to the contributing transactions", async () => {
    const account = await prismaModule.prisma.account.findFirstOrThrow({
      where: { type: "CHECKING" },
    });
    await prismaModule.prisma.transaction.createMany({
      data: ["2026-05-22", "2026-06-05", "2026-06-19", "2026-07-02"].map((date, index) => ({
        householdId: account.householdId,
        accountId: account.id,
        originalDescription: "EURONET PAYROLL",
        originalAmountText: String(241_900 + index * 500),
        originalDateText: date,
        normalizedMerchant: "EURONET PAYROLL",
        amountMinor: 241_900 + index * 500,
        transactionDate: new Date(`${date}T00:00:00.000Z`),
        postedDate: new Date(`${date}T00:00:00.000Z`),
        type: "INCOME",
      })),
    });
    const result = await payroll.payrollDashboard(new Date("2026-07-12T23:59:59.000Z"));
    expect(result.primary).not.toBeNull();
    expect(result.primary?.cadence).toBe("BIWEEKLY");
    expect(result.typicalPaycheckMinor).toBeGreaterThan(0);
    expect(result.normalizedMonthlyPayrollMinor).toBe(
      Math.round((result.typicalPaycheckMinor! * 26) / 12),
    );
    expect(result.mostRecentPaycheck?.id).toBe(result.primary?.contributingTransactions.at(-1)?.id);
    expect(result.reasons.length).toBeGreaterThan(0);
  });
});
