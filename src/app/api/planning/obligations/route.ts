import { NextResponse } from "next/server";
import { createObligation } from "@/server/data/planning";
import { jsonError } from "@/server/data/errors";
export async function POST(r: Request) {
  try {
    return NextResponse.json(await createObligation(await r.json()), { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
