import { prisma } from "@/server/db/prisma";
import { emergencyFundConfigurationSchema } from "@/domain/planning/emergency-configuration";
import { auditFields, auditChange } from "./audit";
import { AppError } from "./errors";

const include = {
  accounts: { include: { account: true }, orderBy: { sortOrder: "asc" as const } },
};

export async function getEmergencyFundConfiguration() {
  const household = await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const configuration = await prisma.emergencyFundConfiguration.findUnique({
    where: { householdId: household.id },
    include,
  });
  const eligibleAccounts = await prisma.account.findMany({
    where: {
      householdId: household.id,
      archivedAt: null,
      type: { in: ["SAVINGS", "CHECKING", "CASH"] },
    },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return {
    configuration: configuration ?? {
      id: null,
      householdId: household.id,
      enabled: false,
      targetAmountMinor: null,
      targetRunwayMonths: 3,
      accounts: [],
    },
    eligibleAccounts,
  };
}

export async function updateEmergencyFundConfiguration(input: unknown) {
  const data = emergencyFundConfigurationSchema.parse(input);
  const household = await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const accountIds = data.accounts.map((item) => item.accountId);
  const eligible = await prisma.account.findMany({
    where: {
      id: { in: accountIds },
      householdId: household.id,
      archivedAt: null,
      type: { in: ["SAVINGS", "CHECKING", "CASH"] },
    },
  });
  if (eligible.length !== accountIds.length)
    throw new AppError("Every emergency-fund source must be an active liquid account.", 422);
  const before = await prisma.emergencyFundConfiguration.findUnique({
    where: { householdId: household.id },
    include,
  });
  const result = await prisma.$transaction(async (tx) => {
    const configuration = await tx.emergencyFundConfiguration.upsert({
      where: { householdId: household.id },
      create: {
        householdId: household.id,
        enabled: data.enabled,
        targetAmountMinor: data.targetAmountMinor,
        targetRunwayMonths: data.targetRunwayMonths,
      },
      update: {
        enabled: data.enabled,
        targetAmountMinor: data.targetAmountMinor,
        targetRunwayMonths: data.targetRunwayMonths,
      },
    });
    await tx.emergencyFundAccount.deleteMany({
      where: { emergencyFundConfigurationId: configuration.id },
    });
    for (const [sortOrder, account] of data.accounts.entries())
      await tx.emergencyFundAccount.create({
        data: { emergencyFundConfigurationId: configuration.id, sortOrder, ...account },
      });
    const after = await tx.emergencyFundConfiguration.findUniqueOrThrow({
      where: { id: configuration.id },
      include,
    });
    await auditFields(tx, {
      householdId: household.id,
      entityType: "EmergencyFundConfiguration",
      entityId: configuration.id,
      action: "emergency_configuration_updated",
      before: before ?? {},
      after,
      fields: ["enabled", "targetAmountMinor", "targetRunwayMonths"],
    });
    await auditChange(tx, {
      householdId: household.id,
      entityType: "EmergencyFundConfiguration",
      entityId: configuration.id,
      action: "emergency_accounts_updated",
      field: "accounts",
      previousValue: before?.accounts.map((item) => item.accountId) ?? [],
      newValue: after.accounts.map((item) => item.accountId),
    });
    return after;
  });
  return result;
}
