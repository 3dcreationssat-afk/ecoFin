import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { resetDemoData } from "@/server/data/repositories";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body.confirmation !== "RESET DEMO DATA") {
      return NextResponse.json(
        { error: "Type RESET DEMO DATA to confirm the single-household demo reset." },
        { status: 422 },
      );
    }
    const household = await resetDemoData();
    return NextResponse.json({ household });
  } catch (error) {
    return jsonError(error);
  }
}
