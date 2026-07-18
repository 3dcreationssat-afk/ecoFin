import { NextResponse } from "next/server";
import { discardReviewChangesForUndo } from "@/server/data/imports";
import { jsonError } from "@/server/data/errors";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await discardReviewChangesForUndo(id, await request.json());
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
