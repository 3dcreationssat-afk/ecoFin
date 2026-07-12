import { NextResponse } from "next/server";
import { createExpectedIncome, planningDashboard } from "@/server/data/planning";
import { jsonError } from "@/server/data/errors";
export async function GET() {
  try {
    return NextResponse.json(await planningDashboard());
  } catch (e) {
    return jsonError(e);
  }
}
export async function POST(r: Request) {
  try {
    return NextResponse.json(await createExpectedIncome(await r.json()), { status: 201 });
  } catch (e) {
    return jsonError(e);
  }
}
