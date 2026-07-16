import { NextResponse } from "next/server";
import { actOnForecastRule, updateForecastRule } from "@/server/data/forecast-rules";
import { jsonError } from "@/server/data/errors";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    return NextResponse.json({
      rule: body.action ? await actOnForecastRule(id, body) : await updateForecastRule(id, body),
    });
  } catch (error) {
    return jsonError(error);
  }
}
