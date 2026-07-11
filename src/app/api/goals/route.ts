import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { createGoal, getHousehold } from "@/server/data/repositories";

export async function GET() {
  try {
    const household = await getHousehold();
    return NextResponse.json({ goals: household.goals, householdId: household.id });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const goal = await createGoal(await request.json());
    return NextResponse.json({ goal }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
