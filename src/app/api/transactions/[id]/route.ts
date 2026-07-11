import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { updateTransactionEditable } from "@/server/data/repositories";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const transaction = await updateTransactionEditable(id, await request.json());
    return NextResponse.json({ transaction });
  } catch (error) {
    return jsonError(error);
  }
}
