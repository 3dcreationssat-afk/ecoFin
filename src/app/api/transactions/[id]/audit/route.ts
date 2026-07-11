import { NextResponse } from "next/server";
import { jsonError } from "@/server/data/errors";
import { transactionAudit } from "@/server/data/repositories";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const audit = await transactionAudit(id);
    return NextResponse.json({ audit });
  } catch (error) {
    return jsonError(error);
  }
}
