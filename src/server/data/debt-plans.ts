import { prisma } from "@/server/db/prisma";
import { debtPlanSchema } from "@/domain/debt/schema";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";

export async function getDebtPlan(householdId?: string) {
  const household = householdId
    ? await prisma.household.findUnique({ where: { id: householdId } })
    : await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const plan = await prisma.debtPlan.findFirst({
    where: { householdId: household.id, active: true, archivedAt: null },
    include: { order: { orderBy: { position: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return {
    householdId: household.id,
    strategy: plan?.strategy ?? household.debtStrategy,
    extraPaymentMinor: plan?.extraPaymentMinor ?? 0,
    customOrder: plan?.order.map((item) => item.accountId) ?? [],
    saved: Boolean(plan),
    updatedAt: plan?.updatedAt ?? null,
  };
}

export async function saveDebtPlan(input: unknown) {
  const data = debtPlanSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const household = await tx.household.findFirst();
    if (!household) throw new AppError("Household not found.", 404);
    const eligible = await tx.account.findMany({
      where: {
        householdId: household.id,
        archivedAt: null,
        type: { in: ["CREDIT", "LOAN", "MORTGAGE"] },
        ledgerBalanceMinor: { gt: 0 },
        aprBasisPoints: { not: null },
        minimumPaymentMinor: { gt: 0 },
        dueDay: { not: null },
      },
      select: { id: true },
    });
    const eligibleIds = new Set(eligible.map((item) => item.id));
    if (data.strategy === "CUSTOM") {
      if (
        data.customOrder.length !== eligibleIds.size ||
        new Set(data.customOrder).size !== data.customOrder.length ||
        data.customOrder.some((id) => !eligibleIds.has(id))
      ) {
        throw new AppError(
          "Custom order must include every eligible active debt exactly once.",
          422,
        );
      }
    }
    const existing = await tx.debtPlan.findFirst({
      where: { householdId: household.id, active: true, archivedAt: null },
      include: { order: { orderBy: { position: "asc" } } },
    });
    const plan = existing
      ? await tx.debtPlan.update({
          where: { id: existing.id },
          data: { strategy: data.strategy, extraPaymentMinor: data.extraPaymentMinor },
        })
      : await tx.debtPlan.create({
          data: {
            householdId: household.id,
            strategy: data.strategy,
            extraPaymentMinor: data.extraPaymentMinor,
          },
        });
    await tx.debtPlanOrder.deleteMany({ where: { debtPlanId: plan.id } });
    if (data.strategy === "CUSTOM") {
      await tx.debtPlanOrder.createMany({
        data: data.customOrder.map((accountId, position) => ({
          debtPlanId: plan.id,
          accountId,
          position,
        })),
      });
    }
    await tx.household.update({
      where: { id: household.id },
      data: { debtStrategy: data.strategy },
    });
    await auditFields(tx, {
      householdId: household.id,
      entityType: "DebtPlan",
      entityId: plan.id,
      action: existing ? "update" : "create",
      before: existing ?? {},
      after: plan,
      fields: ["strategy", "extraPaymentMinor"],
      source: "user",
    });
    const previousOrder = existing?.order.map((item) => item.accountId) ?? [];
    if (JSON.stringify(previousOrder) !== JSON.stringify(data.customOrder)) {
      await auditChange(tx, {
        householdId: household.id,
        entityType: "DebtPlan",
        entityId: plan.id,
        action: "reorder",
        field: "customOrder",
        previousValue: previousOrder,
        newValue: data.customOrder,
        source: "user",
      });
    }
    return {
      ...plan,
      customOrder: data.strategy === "CUSTOM" ? data.customOrder : [],
    };
  });
}
