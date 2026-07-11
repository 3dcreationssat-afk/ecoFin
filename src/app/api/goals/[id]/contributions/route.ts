import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { contributeToGoal } from "@/server/data/repositories";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await contributeToGoal(id, await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
