import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { AppError } from "@/server/data/errors";
import { plaidAccountMatchPreview, resolvePlaidAccount } from "@/server/plaid/connections";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: RouteContext<"/api/plaid/accounts/[id]/match">,
) {
  try {
    const { id } = await context.params;
    const localAccountId = new URL(request.url).searchParams.get("localAccountId");
    if (!localAccountId) throw new AppError("A local account is required for match preview.", 422);
    return NextResponse.json({ preview: await plaidAccountMatchPreview(id, localAccountId) });
  } catch (error) {
    return jsonError(error);
  }
}

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
