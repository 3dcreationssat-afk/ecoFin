import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { disconnectPlaidItem } from "@/server/plaid/connections";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: RouteContext<"/api/plaid/items/[id]/disconnect">,
) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await disconnectPlaidItem(id, await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
