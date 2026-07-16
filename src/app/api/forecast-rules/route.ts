import { NextResponse } from "next/server";
import { detectForecastRules, forecastRuleDashboard } from "@/server/data/forecast-rules";

export async function GET() {
  return NextResponse.json(await forecastRuleDashboard());
}
export async function POST() {
  return NextResponse.json(await detectForecastRules());
}
