import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { createImportProfile, importDashboard } from "@/server/data/imports";

export async function GET() {
  try {
    const data = await importDashboard();
    return NextResponse.json({ profiles: data.profiles });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const profile = await createImportProfile(await request.json());
    return NextResponse.json({ profile }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
