import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { undoImportBatch } from "@/server/data/imports";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const batch = await undoImportBatch(id, await request.json());
    return NextResponse.json({ batch });
  } catch (error) {
    return jsonError(error);
  }
}
