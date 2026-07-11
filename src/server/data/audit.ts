import type { Prisma, PrismaClient } from "@prisma/client";

export function serializeAuditValue(value: unknown) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export async function auditChange(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    householdId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    field?: string;
    previousValue?: unknown;
    newValue?: unknown;
    reason?: string;
    source?: string;
  },
) {
  await prisma.auditLog.create({
    data: {
      householdId: input.householdId ?? null,
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      field: input.field,
      previousValue: serializeAuditValue(input.previousValue),
      newValue: serializeAuditValue(input.newValue),
      reason: input.reason,
      source: input.source ?? "user",
    },
  });
}

export async function auditFields(
  prisma: PrismaClient | Prisma.TransactionClient,
  input: {
    householdId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
    fields: string[];
    source?: string;
  },
) {
  for (const field of input.fields) {
    if (serializeAuditValue(input.before[field]) === serializeAuditValue(input.after[field]))
      continue;
    await auditChange(prisma, {
      ...input,
      field,
      previousValue: input.before[field],
      newValue: input.after[field],
    });
  }
}
