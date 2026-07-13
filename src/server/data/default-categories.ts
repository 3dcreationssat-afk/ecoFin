import type { Category, Prisma } from "@prisma/client";
import { PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

export const DEFAULT_CATEGORY_DEFINITIONS = [
  {
    id: "default-category-fixed",
    systemKey: "FIXED",
    name: "Fixed",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 0,
    sortOrder: 1,
  },
  {
    id: "default-category-essential-variable",
    systemKey: "ESSENTIAL_VARIABLE",
    name: "Essential Variable",
    group: "Essential Variable",
    type: "EXPENSE",
    budgetMinor: 0,
    sortOrder: 2,
  },
  {
    id: "default-category-discretionary",
    systemKey: "DISCRETIONARY",
    name: "Discretionary",
    group: "Discretionary",
    type: "EXPENSE",
    budgetMinor: 0,
    sortOrder: 3,
  },
  {
    id: "default-category-income",
    systemKey: "INCOME",
    name: "Income",
    group: "Income",
    type: "INCOME",
    budgetMinor: 485_000,
    sortOrder: 110,
  },
  {
    id: "default-category-mortgage",
    systemKey: "MORTGAGE",
    parentKey: "FIXED",
    name: "Mortgage",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 165_000,
    sortOrder: 10,
  },
  {
    id: "default-category-auto-loan",
    systemKey: "AUTO_LOAN",
    parentKey: "FIXED",
    name: "Auto Loan",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 38_000,
    sortOrder: 20,
  },
  {
    id: "default-category-car-insurance",
    systemKey: "CAR_INSURANCE",
    parentKey: "FIXED",
    name: "Car Insurance",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 18_000,
    sortOrder: 30,
  },
  {
    id: "default-category-phone",
    systemKey: "PHONE",
    parentKey: "FIXED",
    name: "Phone",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 8_500,
    sortOrder: 40,
  },
  {
    id: "default-category-internet",
    systemKey: "INTERNET",
    parentKey: "FIXED",
    name: "Internet",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 7_000,
    sortOrder: 50,
  },
  {
    id: "default-category-life-insurance",
    systemKey: "LIFE_INSURANCE",
    parentKey: "FIXED",
    name: "Life Insurance",
    group: "Fixed",
    type: "EXPENSE",
    budgetMinor: 4_500,
    sortOrder: 60,
  },
  {
    id: "default-category-groceries",
    systemKey: "GROCERIES",
    parentKey: "ESSENTIAL_VARIABLE",
    name: "Groceries",
    group: "Essential Variable",
    type: "EXPENSE",
    budgetMinor: 65_000,
    sortOrder: 70,
  },
  {
    id: "default-category-dining",
    systemKey: "DINING",
    parentKey: "DISCRETIONARY",
    name: "Dining",
    group: "Discretionary",
    type: "EXPENSE",
    budgetMinor: 25_000,
    sortOrder: 80,
  },
  {
    id: "default-category-gas",
    systemKey: "GAS",
    parentKey: "ESSENTIAL_VARIABLE",
    name: "Gas",
    group: "Essential Variable",
    type: "EXPENSE",
    budgetMinor: 18_000,
    sortOrder: 90,
  },
  {
    id: "default-category-subscriptions",
    systemKey: "SUBSCRIPTIONS",
    parentKey: "DISCRETIONARY",
    name: "Subscriptions",
    group: "Discretionary",
    type: "EXPENSE",
    budgetMinor: 9_000,
    sortOrder: 100,
  },
] as const;

export type DefaultCategoryKey = (typeof DEFAULT_CATEGORY_DEFINITIONS)[number]["systemKey"];

export async function seedDefaultCategories(
  db: Db,
  householdId: string,
  options: { isDemo: boolean },
) {
  const categories = {} as Record<DefaultCategoryKey, Category>;

  for (const definition of DEFAULT_CATEGORY_DEFINITIONS) {
    const parentKey = "parentKey" in definition ? definition.parentKey : null;
    const parentId = parentKey ? categories[parentKey].id : null;
    const data = {
      householdId,
      systemKey: definition.systemKey,
      isSystem: true,
      isDemo: options.isDemo,
      parentId,
      name: definition.name,
      group: definition.group,
      type: definition.type,
      budgetMinor: definition.budgetMinor,
      sortOrder: definition.sortOrder,
      archivedAt: null,
    };
    categories[definition.systemKey] = await db.category.upsert({
      where: { id: definition.id },
      create: { id: definition.id, ...data },
      update: data,
    });
  }

  return categories;
}
