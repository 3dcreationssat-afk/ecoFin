import { NextResponse } from "next/server";
import { duplicateDecisionScenario } from "@/server/data/decision-scenarios";
import { jsonError } from "@/server/data/errors";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/decision-scenarios/[id]/duplicate">,
) {
  try {
    return NextResponse.json(await duplicateDecisionScenario((await context.params).id), {
      status: 201,
    });
  } catch (error) {
    return jsonError(error);
  }
}
