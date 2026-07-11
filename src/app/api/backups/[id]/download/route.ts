import { readFileSync } from "node:fs";
import { NextResponse } from "next/server";
import { backupDownloadPath } from "@/server/data/backup";
import { jsonError } from "@/server/data/errors";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { path, record } = await backupDownloadPath(id);
    return new NextResponse(readFileSync(path), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${record.filename}"`,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}
