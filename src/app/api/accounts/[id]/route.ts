import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { deleteAccount, setAccountArchived, updateAccount } from "@/server/data/repositories";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const account =
      body.action === "archive"
        ? await setAccountArchived(id, true)
        : body.action === "restore"
          ? await setAccountArchived(id, false)
          : await updateAccount(id, body);
    return NextResponse.json({ account });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ deleted: await deleteAccount(id) });
  } catch (error) {
    return jsonError(error);
  }
}
