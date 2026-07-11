import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { setGoalArchived, updateGoal } from "@/server/data/repositories";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const goal =
      body.action === "archive"
        ? await setGoalArchived(id, true)
        : body.action === "restore"
          ? await setGoalArchived(id, false)
          : await updateGoal(id, body);
    return NextResponse.json({ goal });
  } catch (error) {
    return jsonError(error);
  }
}
