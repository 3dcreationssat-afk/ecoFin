import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { runSelectiveReset } from "@/server/data/selective-reset";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json(await runSelectiveReset(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
