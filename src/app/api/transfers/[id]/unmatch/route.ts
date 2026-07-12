import { NextRequest, NextResponse } from "next/server";
import { unmatchTransfer } from "@/server/data/transfers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await unmatchTransfer(id, await request.json());
  return NextResponse.json({ match });
}
