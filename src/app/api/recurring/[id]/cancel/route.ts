import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { markRecurringCanceled } from "@/server/data/recurring";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const recurring = await markRecurringCanceled(id, await request.json());
    return NextResponse.json({ recurring });
  } catch (error) {
    return jsonError(error);
  }
}
