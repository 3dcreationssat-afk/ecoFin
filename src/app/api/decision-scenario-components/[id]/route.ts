import { NextResponse } from "next/server";
import { removeScenarioComponent, updateScenarioComponent } from "@/server/data/decision-scenarios";
import { jsonError } from "@/server/data/errors";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/decision-scenario-components/[id]">,
) {
  try {
    return NextResponse.json(
      await updateScenarioComponent((await context.params).id, await request.json()),
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/decision-scenario-components/[id]">,
) {
  try {
    return NextResponse.json(await removeScenarioComponent((await context.params).id));
  } catch (error) {
    return jsonError(error);
  }
}
