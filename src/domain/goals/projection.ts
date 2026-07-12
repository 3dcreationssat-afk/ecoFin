export type GoalProjectionInput = {
  id: string;
  name: string;
  targetMinor: number;
  currentMinor: number;
  plannedMonthlyMinor: number;
  archivedAt?: Date | null;
};

export function projectGoalCompletion(goal: GoalProjectionInput, asOf: Date): Date | null {
  if (goal.archivedAt || goal.targetMinor <= goal.currentMinor) return asOf;
  if (goal.plannedMonthlyMinor <= 0) return null;
  const remaining = goal.targetMinor - goal.currentMinor;
  const months = Math.ceil(remaining / goal.plannedMonthlyMinor);
  return new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth() + months, 1));
}

export function monthDifference(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  return (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth();
}
