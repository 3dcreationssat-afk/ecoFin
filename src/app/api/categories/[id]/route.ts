import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { setCategoryArchived, updateCategory } from "@/server/data/repositories";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const category =
      body.action === "archive"
        ? await setCategoryArchived(id, true)
        : body.action === "restore"
          ? await setCategoryArchived(id, false)
          : await updateCategory(id, body);
    return NextResponse.json({ category });
  } catch (error) {
    return jsonError(error);
  }
}
