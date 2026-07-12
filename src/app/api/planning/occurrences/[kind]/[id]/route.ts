import { NextResponse } from "next/server";
import { actOnOccurrence } from "@/server/data/planning";
import { jsonError } from "@/server/data/errors";
export async function POST(
  r: Request,
  { params }: { params: Promise<{ kind: string; id: string }> },
) {
  try {
    const { kind, id } = await params;
    if (kind !== "income" && kind !== "obligation") throw new Error("Invalid occurrence kind");
    return NextResponse.json(await actOnOccurrence(kind, id, await r.json()));
  } catch (e) {
    return jsonError(e);
  }
}
