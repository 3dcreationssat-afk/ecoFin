import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { selectedCancellationSavings } from "@/server/data/recurring";

export async function POST(request: Request) {
  try {
    const savings = await selectedCancellationSavings(await request.json());
    return NextResponse.json({ savings });
  } catch (error) {
    return jsonError(error);
  }
}
