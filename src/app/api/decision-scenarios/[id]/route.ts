import { NextResponse } from "next/server";
import {
  deleteDecisionScenario,
  getDecisionScenario,
  updateDecisionScenario,
} from "@/server/data/decision-scenarios";
import { jsonError } from "@/server/data/errors";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/decision-scenarios/[id]">,
) {
  try {
    return NextResponse.json(await getDecisionScenario((await context.params).id));
  } catch (error) {
    return jsonError(error);
  }
}
export async function PATCH(
  request: Request,
  context: RouteContext<"/api/decision-scenarios/[id]">,
) {
  try {
    return NextResponse.json(
      await updateDecisionScenario((await context.params).id, await request.json()),
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/decision-scenarios/[id]">,
) {
  try {
    return NextResponse.json(await deleteDecisionScenario((await context.params).id));
  } catch (error) {
    return jsonError(error);
  }
}
