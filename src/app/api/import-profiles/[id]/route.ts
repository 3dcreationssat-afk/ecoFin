import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { setImportProfileArchived, updateImportProfile } from "@/server/data/imports";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const profile =
      typeof body.archived === "boolean"
        ? await setImportProfileArchived(id, body.archived)
        : await updateImportProfile(id, body);
    return NextResponse.json({ profile });
  } catch (error) {
    return jsonError(error);
  }
}
