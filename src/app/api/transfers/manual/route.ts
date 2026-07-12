import { NextRequest, NextResponse } from "next/server";
import { createManualTransfer } from "@/server/data/transfers";

export async function POST(request: NextRequest) {
  const match = await createManualTransfer(await request.json());
  return NextResponse.json({ match });
}
