import { NextResponse } from "next/server";
import { restoreBackup } from "@/server/data/backup";
import { jsonError } from "@/server/data/errors";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const confirmation = String(form.get("confirmation") ?? "");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a backup ZIP file." }, { status: 422 });
    }
    const result = await restoreBackup(Buffer.from(await file.arrayBuffer()), { confirmation });
    return NextResponse.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
