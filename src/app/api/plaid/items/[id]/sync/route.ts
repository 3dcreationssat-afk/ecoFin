import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { syncPlaidItem } from "@/server/plaid/sync";

export const runtime = "nodejs";

export async function POST(_request: Request, context: RouteContext<"/api/plaid/items/[id]/sync">) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await syncPlaidItem(id));
  } catch (error) {
    return jsonError(error);
  }
}
