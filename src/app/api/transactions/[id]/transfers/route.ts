import { NextResponse } from "next/server";
import { transferContextForTransaction } from "@/server/data/transfers";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const matches = await transferContextForTransaction(id);
  return NextResponse.json({ matches });
}
