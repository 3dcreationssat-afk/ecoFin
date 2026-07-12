import { NextResponse } from "next/server";
import { addScenarioComponent } from "@/server/data/decision-scenarios";
import { jsonError } from "@/server/data/errors";

export async function POST(
  request: Request,
  context: RouteContext<"/api/decision-scenarios/[id]/components">,
) {
  try {
    return NextResponse.json(
      await addScenarioComponent((await context.params).id, await request.json()),
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
