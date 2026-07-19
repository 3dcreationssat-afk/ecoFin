import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { markAllNotificationsRead, notificationDashboard } from "@/server/data/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await notificationDashboard());
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH() {
  try {
    return NextResponse.json(await markAllNotificationsRead());
  } catch (error) {
    return jsonError(error);
  }
}
