import { NextResponse } from "next/server";
import { updateSavingsPolicy } from "@/server/data/planning";
import { jsonError } from "@/server/data/errors";
export async function PATCH(r: Request) {
  try {
    return NextResponse.json(await updateSavingsPolicy(await r.json()));
  } catch (e) {
    return jsonError(e);
  }
}
