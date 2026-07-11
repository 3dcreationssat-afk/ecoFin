import { NextResponse } from "next/server";
import { accountSchema } from "@/domain/accounts/schema";
import { prisma } from "@/server/db/prisma";

export async function GET() {
  const accounts = await prisma.account.findMany({ orderBy: [{ type: "asc" }, { name: "asc" }] });
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const body = accountSchema.parse(await request.json());
  const account = await prisma.account.create({ data: body });
  return NextResponse.json({ account }, { status: 201 });
}
