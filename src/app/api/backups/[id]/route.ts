import { NextResponse } from "next/server";
import { deleteBackupRecord } from "@/server/data/backup";
import { jsonError } from "@/server/data/errors";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const record = await deleteBackupRecord(id, body.confirmation);
    return NextResponse.json({ record });
  } catch (error) {
    return jsonError(error);
  }
}
