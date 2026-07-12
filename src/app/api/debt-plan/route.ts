import { NextResponse } from "next/server";
import { getDebtPlan, saveDebtPlan } from "@/server/data/debt-plans";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    return NextResponse.json(await getDebtPlan());
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    return NextResponse.json(await saveDebtPlan(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
