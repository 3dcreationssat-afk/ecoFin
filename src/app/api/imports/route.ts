import { NextResponse } from "next/server";
import { importDashboard } from "@/server/data/imports";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    const data = await importDashboard();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error);
  }
}
