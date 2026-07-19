import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { exchangePlaidPublicToken } from "@/server/plaid/connections";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    return NextResponse.json(await exchangePlaidPublicToken(await request.json()), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
