import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { previewImport } from "@/server/data/imports";

export async function POST(request: Request) {
  try {
    const batch = await previewImport(await request.json());
    return NextResponse.json({ batch });
  } catch (error) {
    return jsonError(error);
  }
}
