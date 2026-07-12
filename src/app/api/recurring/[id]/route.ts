import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { updateRecurringExpense } from "@/server/data/recurring";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const recurring = await updateRecurringExpense(id, await request.json());
    return NextResponse.json({ recurring });
  } catch (error) {
    return jsonError(error);
  }
}
