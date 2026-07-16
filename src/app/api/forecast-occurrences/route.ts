import { NextResponse } from "next/server";
import { actOnForecastOccurrence } from "@/server/data/forecast-rules";
import { jsonError } from "@/server/data/errors";

export async function POST(request: Request) {
  try {
    return NextResponse.json({ occurrence: await actOnForecastOccurrence(await request.json()) });
  } catch (error) {
    return jsonError(error);
  }
}
