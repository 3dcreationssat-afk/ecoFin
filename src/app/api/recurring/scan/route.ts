import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { scanRecurringExpenses } from "@/server/data/recurring";

export async function POST() {
  try {
    const result = await scanRecurringExpenses();
    return NextResponse.json({ result });
  } catch (error) {
    return jsonError(error);
  }
}
