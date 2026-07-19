import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { resolvePlaidAccount } from "@/server/plaid/connections";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/plaid/accounts/[id]/match">,
) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ account: await resolvePlaidAccount(id, await request.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
