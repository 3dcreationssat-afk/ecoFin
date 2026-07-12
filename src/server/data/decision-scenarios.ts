import { prisma } from "@/server/db/prisma";
import type { Prisma } from "@prisma/client";
import {
  createScenarioSchema,
  scenarioComponentSchema,
  updateScenarioSchema,
} from "@/domain/decisions/schema";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";
import { getCashFlowInput } from "./cash-flow";
import { getDebtPlan } from "./debt-plans";
import { evaluateScenario, type ScenarioComponent } from "@/domain/decisions/engine";
import type { DebtInput } from "@/domain/debt/payoff";

const includeComponents = { components: { orderBy: { sortOrder: "asc" as const } } };

export async function listDecisionScenarios(options: { includeArchived?: boolean } = {}) {
  const household = await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  return prisma.decisionScenario.findMany({
    where: { householdId: household.id, ...(options.includeArchived ? {} : { archivedAt: null }) },
    include: includeComponents,
    orderBy: [{ archivedAt: "asc" }, { updatedAt: "desc" }],
  });
}

export async function decisionSimulatorDashboard(scenarioId?: string) {
  const scenarios = await listDecisionScenarios({ includeArchived: true });
  const selected =
    scenarios.find((item) => item.id === scenarioId) ??
    scenarios.find((item) => !item.archivedAt) ??
    scenarios[0] ??
    null;
  const household = await prisma.household.findFirst({
    include: { accounts: true, goals: true, recurringExpenses: true },
  });
  if (!household) throw new AppError("Household not found.", 404);
  const asOf = new Date("2026-07-12T00:00:00.000Z");
  const [cashFlowInput, debtPlan] = await Promise.all([
    getCashFlowInput(asOf),
    getDebtPlan(household.id),
  ]);
  const debtInputs: DebtInput[] = household.accounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    balanceMinor: account.ledgerBalanceMinor ?? 0,
    aprBasisPoints: account.aprBasisPoints,
    minimumPaymentMinor: account.minimumPaymentMinor,
    dueDay: account.dueDay,
    archivedAt: account.archivedAt,
    reconciliationStatus: account.reconciliationStatus,
    balanceConfidence: account.balanceConfidence,
    lastReconciledAt: account.lastReconciledAt,
  }));
  const evaluation = selected
    ? evaluateScenario({
        cashFlowInput,
        debtInputs,
        debtStrategy: debtPlan.strategy as "AVALANCHE" | "SNOWBALL" | "CUSTOM",
        debtExtraPaymentMinor: debtPlan.extraPaymentMinor,
        debtCustomOrder: debtPlan.customOrder,
        components: selected.components.map((component) => ({
          ...component,
        })) as ScenarioComponent[],
      })
    : null;
  return {
    scenarios,
    selected,
    evaluation,
    options: {
      accounts: household.accounts
        .filter((item) => !item.archivedAt)
        .map((item) => ({ id: item.id, name: item.name, type: item.type })),
      debts: household.accounts
        .filter(
          (item) =>
            !item.archivedAt &&
            ["CREDIT", "LOAN", "MORTGAGE"].includes(item.type) &&
            (item.ledgerBalanceMinor ?? 0) > 0,
        )
        .map((item) => ({ id: item.id, name: item.name })),
      goals: household.goals
        .filter((item) => !item.archivedAt)
        .map((item) => ({ id: item.id, name: item.name })),
      recurring: household.recurringExpenses
        .filter((item) => item.status === "CONFIRMED")
        .map((item) => ({
          id: item.id,
          name: item.displayName,
          monthlyMinor: item.monthlyEquivalentMinor,
        })),
    },
  };
}

export async function getDecisionScenario(id: string) {
  const scenario = await prisma.decisionScenario.findUnique({
    where: { id },
    include: includeComponents,
  });
  if (!scenario) throw new AppError("Scenario not found.", 404);
  return scenario;
}

export async function createDecisionScenario(input: unknown) {
  const data = createScenarioSchema.parse(input);
  const household = await prisma.household.findFirst();
  if (!household) throw new AppError("Household not found.", 404);
  const created = await prisma.decisionScenario.create({
    data: { householdId: household.id, name: data.name, description: data.description ?? null },
    include: includeComponents,
  });
  await auditChange(prisma, {
    householdId: household.id,
    entityType: "DecisionScenario",
    entityId: created.id,
    action: "create",
    field: "name",
    newValue: created.name,
  });
  return created;
}

export async function updateDecisionScenario(id: string, input: unknown) {
  const data = updateScenarioSchema.parse(input);
  const existing = await prisma.decisionScenario.findUnique({ where: { id } });
  if (!existing) throw new AppError("Scenario not found.", 404);
  const update = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description } : {}),
    ...(data.action === "ARCHIVE" ? { archivedAt: new Date(), status: "ARCHIVED" } : {}),
    ...(data.action === "RESTORE" ? { archivedAt: null, status: "DRAFT" } : {}),
  };
  const updated = await prisma.decisionScenario.update({
    where: { id },
    data: update,
    include: includeComponents,
  });
  await auditFields(prisma, {
    householdId: existing.householdId,
    entityType: "DecisionScenario",
    entityId: id,
    action: data.action?.toLowerCase() ?? "update",
    before: existing,
    after: updated,
    fields: ["name", "description", "status", "archivedAt"],
  });
  return updated;
}

export async function duplicateDecisionScenario(id: string) {
  const existing = await getDecisionScenario(id);
  const duplicate = await prisma.decisionScenario.create({
    data: {
      householdId: existing.householdId,
      name: `${existing.name} copy`.slice(0, 100),
      description: existing.description,
      components: {
        create: existing.components.map((component) => ({
          ...component,
          id: undefined,
          scenarioId: undefined,
          createdAt: undefined,
          updatedAt: undefined,
        })),
      },
    },
    include: includeComponents,
  });
  await auditChange(prisma, {
    householdId: existing.householdId,
    entityType: "DecisionScenario",
    entityId: duplicate.id,
    action: "duplicate",
    field: "sourceScenarioId",
    newValue: existing.id,
  });
  return duplicate;
}

export async function deleteDecisionScenario(id: string) {
  const existing = await getDecisionScenario(id);
  await prisma.$transaction(async (tx) => {
    await tx.decisionScenario.delete({ where: { id } });
    await auditChange(tx, {
      householdId: existing.householdId,
      entityType: "DecisionScenario",
      entityId: id,
      action: "delete",
      field: "name",
      previousValue: existing.name,
    });
  });
  return { id };
}

export async function addScenarioComponent(scenarioId: string, input: unknown) {
  const data = scenarioComponentSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const scenario = await tx.decisionScenario.findUnique({ where: { id: scenarioId } });
    if (!scenario || scenario.archivedAt) throw new AppError("Active scenario not found.", 404);
    await validateLinks(tx, scenario.householdId, data);
    const last = await tx.decisionScenarioComponent.aggregate({
      where: { scenarioId },
      _max: { sortOrder: true },
    });
    const created = await tx.decisionScenarioComponent.create({
      data: { scenarioId, ...data, sortOrder: (last._max.sortOrder ?? -1) + 1 },
    });
    await auditChange(tx, {
      householdId: scenario.householdId,
      entityType: "DecisionScenarioComponent",
      entityId: created.id,
      action: "add",
      field: "type",
      newValue: created.type,
    });
    return created;
  });
}

export async function updateScenarioComponent(id: string, input: unknown) {
  const data = scenarioComponentSchema.parse(input);
  return prisma.$transaction(async (tx) => {
    const existing = await tx.decisionScenarioComponent.findUnique({
      where: { id },
      include: { scenario: true },
    });
    if (!existing || existing.scenario.archivedAt)
      throw new AppError("Active component not found.", 404);
    await validateLinks(tx, existing.scenario.householdId, data);
    const updated = await tx.decisionScenarioComponent.update({ where: { id }, data });
    await auditFields(tx, {
      householdId: existing.scenario.householdId,
      entityType: "DecisionScenarioComponent",
      entityId: id,
      action: "edit",
      before: existing,
      after: updated,
      fields: Object.keys(data),
    });
    return updated;
  });
}

export async function removeScenarioComponent(id: string) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.decisionScenarioComponent.findUnique({
      where: { id },
      include: { scenario: true },
    });
    if (!existing) throw new AppError("Component not found.", 404);
    await tx.decisionScenarioComponent.delete({ where: { id } });
    await auditChange(tx, {
      householdId: existing.scenario.householdId,
      entityType: "DecisionScenarioComponent",
      entityId: id,
      action: "remove",
      field: "type",
      previousValue: existing.type,
    });
    return { id };
  });
}

async function validateLinks(
  tx: Prisma.TransactionClient,
  householdId: string,
  data: ReturnType<typeof scenarioComponentSchema.parse>,
) {
  const checks = [
    data.linkedAccountId
      ? tx.account.findFirst({ where: { id: data.linkedAccountId, householdId, archivedAt: null } })
      : null,
    data.linkedDebtAccountId
      ? tx.account.findFirst({
          where: {
            id: data.linkedDebtAccountId,
            householdId,
            archivedAt: null,
            type: { in: ["CREDIT", "LOAN", "MORTGAGE"] },
          },
        })
      : null,
    data.linkedGoalId
      ? tx.goal.findFirst({ where: { id: data.linkedGoalId, householdId, archivedAt: null } })
      : null,
    data.linkedRecurringId
      ? tx.recurringExpense.findFirst({
          where: { id: data.linkedRecurringId, householdId, status: "CONFIRMED" },
        })
      : null,
  ];
  const resolved = await Promise.all(checks.map((check) => check ?? Promise.resolve(true)));
  if (resolved.some((value) => !value))
    throw new AppError("A linked scenario record is invalid or archived.", 422);
}
