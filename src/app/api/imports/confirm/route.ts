import { NextResponse } from "next/server";
import { confirmImport } from "@/server/data/imports";
import { jsonError } from "@/server/data/errors";

export async function POST(request: Request) {
  try {
    const batch = await confirmImport(await request.json());
    return NextResponse.json({ batch });
  } catch (error) {
    return jsonError(error);
  }
}
