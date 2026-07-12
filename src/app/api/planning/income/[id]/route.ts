import { NextResponse } from "next/server";
import { setExpectedIncomeState, updateExpectedIncome } from "@/server/data/planning";
import { jsonError } from "@/server/data/errors";
export async function PATCH(r: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await r.json();
    return NextResponse.json(
      body.action
        ? await setExpectedIncomeState(id, body.action)
        : await updateExpectedIncome(id, body),
    );
  } catch (e) {
    return jsonError(e);
  }
}
