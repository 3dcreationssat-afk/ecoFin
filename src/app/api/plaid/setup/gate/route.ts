import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { setPlaidRealConnectivity } from "@/server/plaid/setup";

export const runtime = "nodejs";

export async function PATCH(request: NextRequest) {
  try {
    return NextResponse.json(await setPlaidRealConnectivity(await request.json()));
  } catch (error) {
    return jsonError(error);
  }
}
