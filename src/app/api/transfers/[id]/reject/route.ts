import { NextRequest, NextResponse } from "next/server";
import { rejectTransferMatch } from "@/server/data/transfers";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const match = await rejectTransferMatch(id, await request.json());
  return NextResponse.json({ match });
}
