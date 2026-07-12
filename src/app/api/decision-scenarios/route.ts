import { NextResponse } from "next/server";
import { createDecisionScenario, listDecisionScenarios } from "@/server/data/decision-scenarios";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    return NextResponse.json(await listDecisionScenarios({ includeArchived: true }));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createDecisionScenario(await request.json()), { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
