import { execSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
process.env.DATABASE_URL = "file:./vitest-account-ledger.db";
let prismaModule: typeof import("@/server/db/prisma");
let balances: typeof import("./account-balances");
describe("account balance persistence", () => {
  beforeAll(async () => {
    execSync("npm run db:reset", {
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    });
    prismaModule = await import("@/server/db/prisma");
    balances = await import("./account-balances");
  }, 120000);
  afterAll(async () => prismaModule.prisma.$disconnect());
  it("seeds explicit reconciled anchors without obsolete snapshot fields", async () => {
    const accounts = await prismaModule.prisma.account.findMany();
    expect(
      accounts.every(
        (account) =>
          account.openingBalanceMinor !== null &&
          account.ledgerBalanceMinor === account.reportedBalanceMinor &&
          account.reconciliationStatus === "RECONCILED",
      ),
    ).toBe(true);
    const columns = await prismaModule.prisma.$queryRawUnsafe<{ name: string }[]>(
      "PRAGMA table_info('Account')",
    );
    expect(
      columns.some((column) => column.name === "balanceMinor" || column.name === "availableMinor"),
    ).toBe(false);
  });
  it("reconciles and creates only an explicit adjustment", async () => {
    const account = await prismaModule.prisma.account.findFirst({ where: { type: "CHECKING" } });
    expect(account).toBeTruthy();
    const reported = (account!.ledgerBalanceMinor ?? 0) + 500;
    const unreconciled = await balances.reconcileAccount(account!.id, {
      reportedBalanceMinor: reported,
      reportedBalanceAsOf: new Date("2026-07-12"),
      createAdjustment: false,
    });
    expect(unreconciled?.reconciliationDifferenceMinor).toBe(500);
    expect(await prismaModule.prisma.reconciliationAdjustment.count()).toBe(0);
    const reconciled = await balances.reconcileAccount(account!.id, {
      reportedBalanceMinor: reported,
      reportedBalanceAsOf: new Date("2026-07-12"),
      createAdjustment: true,
      adjustmentReason: "Synthetic missing opening item",
    });
    expect(reconciled?.reconciliationDifferenceMinor).toBe(0);
    expect(await prismaModule.prisma.reconciliationAdjustment.count()).toBe(1);
    expect(
      await prismaModule.prisma.auditLog.count({
        where: { entityType: "ReconciliationAdjustment" },
      }),
    ).toBe(1);
  });
});
