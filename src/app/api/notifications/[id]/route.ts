import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { updateNotification } from "@/server/data/notifications";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json(await updateNotification(id, await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
