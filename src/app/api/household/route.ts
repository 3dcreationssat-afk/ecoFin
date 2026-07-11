import { NextResponse } from "next/server";
import { householdSettingsSchema } from "@/domain/household/schema";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  const household = await prisma.household.findFirst({ include: { accounts: true, categories: true } });
  return NextResponse.json({ household });
}

export async function PUT(request: Request) {
  const body = householdSettingsSchema.parse(await request.json());
  const existing = await prisma.household.findFirst();
  const household = existing
    ? await prisma.household.update({ where: { id: existing.id }, data: body })
    : await prisma.household.create({ data: body });
  return NextResponse.json({ household });
}

