import { NextResponse } from "next/server";
import { AppError, validationError } from "@/server/data/errors";
import { resetDemoDataWithResult } from "@/server/data/repositories";

export async function POST(request: Request) {
  try {
    const result = await resetDemoDataWithResult(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    const normalized = validationError(error);
    if (normalized instanceof AppError) {
      return NextResponse.json(
        {
          ok: false,
          code: normalized.status === 422 ? "RESET_CONFIRMATION_INVALID" : "RESET_FAILED",
          message:
            normalized.status === 422
              ? normalized.message
              : "Demonstration data could not be reset.",
          details: normalized.status === 422 ? undefined : normalized.message,
          issues: normalized.issues,
        },
        { status: normalized.status },
      );
    }
    console.error("Demo reset failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        ok: false,
        code: "RESET_FAILED",
        message: "Demonstration data could not be reset.",
        details: "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
