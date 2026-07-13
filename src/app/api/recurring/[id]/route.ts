import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { recurringEvidence, updateRecurringExpense } from "@/server/data/recurring";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ recurring: await recurringEvidence(id) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const recurring = await updateRecurringExpense(id, await request.json());
    return NextResponse.json({ recurring });
  } catch (error) {
    return jsonError(error);
  }
}
