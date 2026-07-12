import { Prisma, type MerchantRule, type Transaction } from "@prisma/client";
import { prisma } from "@/server/db/prisma";
import { auditChange, auditFields } from "./audit";
import { AppError } from "./errors";
import {
  merchantRuleSchema,
  merchantRuleUpdateSchema,
  normalizeRuleText,
  orderRules,
  ruleMatches,
  rulesConflict,
  isManualSource,
  type MerchantRuleInput,
} from "@/domain/merchant-rules/rules";

type Db = typeof prisma | Prisma.TransactionClient;
async function household(db: Db = prisma) {
  const value = await db.household.findFirst({ select: { id: true } });
  if (!value) throw new AppError("Household not found.", 404);
  return value;
}
const ruleInclude = { category: true } satisfies Prisma.MerchantRuleInclude;
export async function listMerchantRules(db: Db = prisma) {
  const h = await household(db);
  return db.merchantRule.findMany({
    where: { householdId: h.id, archivedAt: null },
    include: ruleInclude,
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
}

async function validateCategory(db: Db, householdId: string, categoryId?: string | null) {
  if (!categoryId) return;
  if (!(await db.category.findFirst({ where: { id: categoryId, householdId, archivedAt: null } })))
    throw new AppError("Category is invalid or archived.", 422);
}
function ruleData(data: Partial<MerchantRuleInput>) {
  return {
    ...data,
    ...(data.name ? { normalizedName: normalizeRuleText(data.name) } : {}),
    ...(data.pattern ? { normalizedPattern: normalizeRuleText(data.pattern) } : {}),
  };
}

export async function createMerchantRule(input: unknown, applyExisting = false) {
  const data = merchantRuleSchema.parse(input);
  const h = await household();
  await validateCategory(prisma, h.id, data.categoryId);
  try {
    return await prisma.$transaction(async (tx) => {
      const rule = await tx.merchantRule.create({
        data: {
          householdId: h.id,
          name: data.name,
          normalizedName: normalizeRuleText(data.name),
          priority: data.priority,
          active: data.active,
          matchField: data.matchField,
          matchType: data.matchType,
          pattern: data.pattern,
          normalizedPattern: normalizeRuleText(data.pattern),
          normalizedMerchant: data.normalizedMerchant,
          categoryId: data.categoryId,
          transactionType: data.transactionType,
          markReviewed: data.markReviewed,
          notes: data.notes,
        },
      });
      await auditChange(tx, {
        householdId: h.id,
        entityType: "MerchantRule",
        entityId: rule.id,
        action: "create",
        field: "rule",
        newValue: rule.name,
        source: "merchant_rule",
      });
      const application = applyExisting ? await applyRuleToExisting(tx, rule, h.id) : undefined;
      return { rule, application };
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")
      throw new AppError("A merchant rule with that name already exists.", 409);
    throw error;
  }
}

export async function updateMerchantRule(id: string, input: unknown, applyExisting = false) {
  const data = merchantRuleUpdateSchema.parse(input);
  const h = await household();
  await validateCategory(prisma, h.id, data.categoryId);
  const existing = await prisma.merchantRule.findFirst({
    where: { id, householdId: h.id, archivedAt: null },
  });
  if (!existing) throw new AppError("Merchant rule not found.", 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.merchantRule.update({ where: { id }, data: ruleData(data) });
    await auditFields(tx, {
      householdId: h.id,
      entityType: "MerchantRule",
      entityId: id,
      action: "update",
      before: existing,
      after: updated,
      fields: Object.keys(data),
      source: "merchant_rule",
    });
    const application = applyExisting ? await applyRuleToExisting(tx, updated, h.id) : undefined;
    return { rule: updated, application };
  });
}
export async function archiveMerchantRule(id: string) {
  const h = await household();
  const existing = await prisma.merchantRule.findFirst({
    where: { id, householdId: h.id, archivedAt: null },
  });
  if (!existing) throw new AppError("Merchant rule not found.", 404);
  return prisma.$transaction(async (tx) => {
    const rule = await tx.merchantRule.update({
      where: { id },
      data: { archivedAt: new Date(), active: false },
    });
    await auditChange(tx, {
      householdId: h.id,
      entityType: "MerchantRule",
      entityId: id,
      action: "archive",
      field: "archivedAt",
      newValue: rule.archivedAt,
      source: "merchant_rule",
    });
    return { rule };
  });
}
export async function setMerchantRuleActive(id: string, active: boolean) {
  return updateMerchantRule(id, { active });
}

type RuleLike = MerchantRule;
function ruleInput(rule: RuleLike) {
  return {
    ...rule,
    matchField: rule.matchField as MerchantRuleInput["matchField"],
    matchType: rule.matchType as MerchantRuleInput["matchType"],
    transactionType: rule.transactionType as MerchantRuleInput["transactionType"],
  };
}
function protections(
  transaction: Transaction & {
    outgoingTransferMatches?: { status: string }[];
    incomingTransferMatches?: { status: string }[];
    recurringLinks?: { recurringExpense: { status: string } }[];
  },
  rule: RuleLike,
) {
  const reasons: string[] = [];
  const confirmedTransfer = [
    ...(transaction.outgoingTransferMatches ?? []),
    ...(transaction.incomingTransferMatches ?? []),
  ].some((match) => match.status === "CONFIRMED");
  const confirmedRecurring = transaction.recurringLinks?.some(
    (link) => link.recurringExpense.status === "CONFIRMED",
  );
  if (confirmedTransfer && rule.transactionType) reasons.push("confirmed transfer classification");
  if (confirmedRecurring && (rule.transactionType || rule.normalizedMerchant))
    reasons.push("confirmed recurring integrity");
  if (rule.normalizedMerchant && isManualSource(transaction.merchantSource))
    reasons.push("manual merchant override");
  if (rule.categoryId && isManualSource(transaction.categorySource))
    reasons.push("manual category override");
  if (rule.transactionType && isManualSource(transaction.typeSource))
    reasons.push("manual type override");
  if (rule.markReviewed && isManualSource(transaction.reviewSource))
    reasons.push("manual review override");
  return reasons;
}
function proposedUpdate(transaction: Transaction, rule: RuleLike): Prisma.TransactionUpdateInput {
  const data: Prisma.TransactionUpdateInput = {
    appliedMerchantRule: { connect: { id: rule.id } },
    ruleAppliedAt: new Date(),
  };
  if (rule.normalizedMerchant && !isManualSource(transaction.merchantSource))
    Object.assign(data, {
      normalizedMerchant: rule.normalizedMerchant,
      merchantSource: "MERCHANT_RULE",
    });
  if (rule.categoryId && !isManualSource(transaction.categorySource))
    Object.assign(data, {
      category: { connect: { id: rule.categoryId } },
      categorySource: "MERCHANT_RULE",
    });
  if (rule.transactionType && !isManualSource(transaction.typeSource))
    Object.assign(data, { type: rule.transactionType, typeSource: "MERCHANT_RULE" });
  if (rule.markReviewed && !isManualSource(transaction.reviewSource))
    Object.assign(data, { reviewStatus: "REVIEWED", reviewSource: "MERCHANT_RULE" });
  return data;
}

export async function previewMerchantRule(input: unknown) {
  const data = merchantRuleSchema.parse(input);
  const h = await household();
  await validateCategory(prisma, h.id, data.categoryId);
  const existing = await listMerchantRules();
  const candidate = {
    id: "preview",
    householdId: h.id,
    normalizedName: normalizeRuleText(data.name),
    normalizedPattern: normalizeRuleText(data.pattern),
    lastAppliedAt: null,
    archivedAt: null,
    createdAt: new Date(8640000000000000),
    updatedAt: new Date(),
    ...data,
  } as MerchantRule;
  const transactions = await prisma.transaction.findMany({
    where: { householdId: h.id },
    include: {
      account: true,
      category: true,
      outgoingTransferMatches: true,
      incomingTransferMatches: true,
      recurringLinks: { include: { recurringExpense: true } },
    },
    take: 1001,
  });
  const matched = transactions.filter((transaction) =>
    ruleMatches(ruleInput(candidate), transaction),
  );
  const samples = matched.slice(0, 10).map((transaction) => ({
    id: transaction.id,
    merchant: transaction.normalizedMerchant,
    category: transaction.category?.name ?? null,
    type: transaction.type,
    proposedMerchant: data.normalizedMerchant ?? transaction.normalizedMerchant,
    proposedCategoryId: data.categoryId ?? transaction.categoryId,
    proposedType: data.transactionType ?? transaction.type,
    protections: protections(transaction, candidate),
  }));
  const active = existing
    .filter((rule) => rule.active && rule.archivedAt === null)
    .map((rule) => ruleInput(rule as MerchantRule));
  const conflictRules = active.filter((rule) =>
    matched.some((transaction) => ruleMatches(rule, transaction)),
  );
  return {
    matchedCount: matched.length,
    eligibleCount: matched.filter((transaction) => protections(transaction, candidate).length === 0)
      .length,
    protectedCount: matched.filter((transaction) => protections(transaction, candidate).length > 0)
      .length,
    truncated: transactions.length > 1000,
    samples,
    conflict: rulesConflict(orderRules([ruleInput(candidate), ...conflictRules]) as never),
    conflictingRuleNames: conflictRules.map((rule) => rule.name),
  };
}

async function applyRuleToExisting(
  tx: Prisma.TransactionClient,
  rule: MerchantRule,
  householdId: string,
  ids?: string[],
) {
  const transactions = await tx.transaction.findMany({
    where: { householdId, ...(ids ? { id: { in: ids } } : {}) },
    include: {
      outgoingTransferMatches: true,
      incomingTransferMatches: true,
      recurringLinks: { include: { recurringExpense: true } },
    },
  });
  const matched = transactions.filter((transaction) => ruleMatches(ruleInput(rule), transaction));
  let applied = 0;
  let skipped = 0;
  for (const transaction of matched) {
    if (protections(transaction, rule).length) {
      skipped++;
      continue;
    }
    const updated = await tx.transaction.update({
      where: { id: transaction.id },
      data: proposedUpdate(transaction, rule),
    });
    await auditFields(tx, {
      householdId,
      entityType: "Transaction",
      entityId: transaction.id,
      action: "merchant_rule_apply",
      before: transaction,
      after: updated,
      fields: ["normalizedMerchant", "categoryId", "type", "reviewStatus"],
      source: "merchant_rule",
    });
    applied++;
  }
  await tx.merchantRule.update({ where: { id: rule.id }, data: { lastAppliedAt: new Date() } });
  await auditChange(tx, {
    householdId,
    entityType: "MerchantRule",
    entityId: rule.id,
    action: "apply_existing",
    field: "transactions",
    previousValue: matched.length,
    newValue: applied,
    reason: `${skipped} protected`,
    source: "merchant_rule",
  });
  return { matched: matched.length, applied, skipped };
}

export async function applyRulesToTransaction(
  tx: Prisma.TransactionClient,
  transaction: Transaction,
  rules: MerchantRule[],
) {
  const matchedRules = rules.filter(
    (rule) => rule.active && !rule.archivedAt && ruleMatches(ruleInput(rule), transaction),
  );
  const orderedInputs = orderRules(matchedRules.map(ruleInput));
  const matches = orderedInputs.map((input) => matchedRules.find((rule) => rule.id === input.id)!);
  const winner = matches[0];
  if (!winner || protections(transaction, winner).length)
    return {
      transaction,
      matched: false,
      conflict: matches.length > 1 && rulesConflict(matches.map(ruleInput) as never),
    };
  const updated = await tx.transaction.update({
    where: { id: transaction.id },
    data: proposedUpdate(transaction, winner),
  });
  await tx.merchantRule.update({ where: { id: winner.id }, data: { lastAppliedAt: new Date() } });
  await auditChange(tx, {
    householdId: transaction.householdId,
    entityType: "Transaction",
    entityId: transaction.id,
    action: "merchant_rule_import",
    field: "appliedMerchantRuleId",
    newValue: winner.id,
    reason: matches.length > 1 ? "Winning rule selected by priority and specificity." : undefined,
    source: "import",
  });
  return {
    transaction: updated,
    matched: true,
    conflict: matches.length > 1 && rulesConflict(matches.map(ruleInput) as never),
  };
}

export async function reapplyRulesToSelected(ids: string[]) {
  if (!ids.length || ids.length > 100)
    throw new AppError("Select between 1 and 100 transactions.", 422);
  const h = await household();
  return prisma.$transaction(async (tx) => {
    const rules = await tx.merchantRule.findMany({
      where: { householdId: h.id, active: true, archivedAt: null },
    });
    let applied = 0;
    let skipped = 0;
    for (const id of ids) {
      const transaction = await tx.transaction.findFirst({ where: { id, householdId: h.id } });
      if (!transaction)
        throw new AppError(
          "A selected transaction is missing or belongs to another household.",
          409,
        );
      const result = await applyRulesToTransaction(tx, transaction, rules);
      if (result.matched) applied++;
      else skipped++;
    }
    return { selected: ids.length, applied, skipped };
  });
}

export async function merchantRuleDataQuality() {
  const h = await household();
  const [rules, transactions, skippedAudits] = await Promise.all([
    prisma.merchantRule.findMany({ where: { householdId: h.id, active: true, archivedAt: null } }),
    prisma.transaction.findMany({
      where: { householdId: h.id },
      select: { originalDescription: true, normalizedMerchant: true },
    }),
    prisma.auditLog.count({
      where: { householdId: h.id, action: "apply_existing", reason: { contains: "protected" } },
    }),
  ]);
  const counts = rules.map(
    (rule) =>
      transactions.filter((transaction) => ruleMatches(ruleInput(rule), transaction)).length,
  );
  let conflicts = 0;
  for (let index = 0; index < rules.length; index++)
    for (let other = index + 1; other < rules.length; other++)
      if (
        rules[index].matchField === rules[other].matchField &&
        rules[index].matchType === rules[other].matchType &&
        rules[index].normalizedPattern === rules[other].normalizedPattern &&
        rulesConflict([ruleInput(rules[index]), ruleInput(rules[other])] as never)
      )
        conflicts++;
  return {
    conflicts,
    zeroMatchRules: counts.filter((count) => count === 0).length,
    broadRules: counts.filter((count) => count > 100).length,
    skippedManualOverrides: skippedAudits,
  };
}
