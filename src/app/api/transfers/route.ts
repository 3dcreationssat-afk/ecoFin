import { NextResponse } from "next/server";
import { scanTransferCandidates, transferReviewQueue } from "@/server/data/transfers";

export async function GET() {
  const queue = await transferReviewQueue();
  return NextResponse.json(queue);
}

export async function POST() {
  const result = await scanTransferCandidates();
  return NextResponse.json({ result });
}
