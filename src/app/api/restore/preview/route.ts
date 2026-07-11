import { NextResponse } from "next/server";
import { restorePreview } from "@/server/data/backup";
import { jsonError } from "@/server/data/errors";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a backup ZIP file." }, { status: 422 });
    }
    if (!file.name.endsWith(".zip")) {
      return NextResponse.json(
        { error: "Only .zip backup packages are supported." },
        { status: 422 },
      );
    }
    const preview = await restorePreview(Buffer.from(await file.arrayBuffer()));
    return NextResponse.json(preview);
  } catch (error) {
    return jsonError(error);
  }
}
