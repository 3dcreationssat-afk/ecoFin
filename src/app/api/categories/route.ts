import { NextResponse } from "next/server";
import { categorySchema } from "@/domain/categories/schema";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  const categories = await prisma.category.findMany({ orderBy: [{ group: "asc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ categories });
}

export async function POST(request: Request) {
  const body = categorySchema.parse(await request.json());
  const category = await prisma.category.create({ data: body });
  return NextResponse.json({ category }, { status: 201 });
}

