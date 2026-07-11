import { NextResponse } from "next/server";
import { backupDashboard, createLocalBackup } from "@/server/data/backup";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    return NextResponse.json(await backupDashboard());
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST() {
  try {
    const result = await createLocalBackup();
    return NextResponse.json({ record: result.record, manifest: result.manifest }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
