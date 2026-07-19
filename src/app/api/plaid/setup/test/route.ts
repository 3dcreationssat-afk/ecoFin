import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { testPlaidConfiguration } from "@/server/plaid/setup";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await testPlaidConfiguration());
  } catch (error) {
    return jsonError(error);
  }
}
