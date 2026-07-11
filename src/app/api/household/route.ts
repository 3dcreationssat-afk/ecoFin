import { NextResponse } from "next/server";
import { getHousehold, updateHousehold } from "@/server/data/repositories";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  try {
    const household = await getHousehold();
    return NextResponse.json({ household });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const household = await updateHousehold(await request.json());
    return NextResponse.json({ household });
  } catch (error) {
    return jsonError(error);
  }
}
