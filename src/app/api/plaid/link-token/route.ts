import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { createPlaidLinkToken } from "@/server/plaid/connections";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const input = (await request.json().catch(() => ({}))) as { updateItemId?: string };
    return NextResponse.json(await createPlaidLinkToken(input));
  } catch (error) {
    return jsonError(error);
  }
}
