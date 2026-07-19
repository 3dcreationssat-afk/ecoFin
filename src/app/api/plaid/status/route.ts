import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { plaidConnectionDashboard } from "@/server/plaid/connections";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await plaidConnectionDashboard());
  } catch (error) {
    return jsonError(error);
  }
}
