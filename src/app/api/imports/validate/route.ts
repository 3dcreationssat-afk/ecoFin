import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { validateImport } from "@/server/data/imports";

export async function POST(request: Request) {
  try {
    const batch = await validateImport(await request.json());
    return NextResponse.json({ batch });
  } catch (error) {
    return jsonError(error);
  }
}
