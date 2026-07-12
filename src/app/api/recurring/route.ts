import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { createManualRecurringExpense, recurringDashboard } from "@/server/data/recurring";

export async function GET() {
  try {
    return NextResponse.json(await recurringDashboard());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const recurring = await createManualRecurringExpense(await request.json());
    return NextResponse.json({ recurring });
  } catch (error) {
    return jsonError(error);
  }
}
