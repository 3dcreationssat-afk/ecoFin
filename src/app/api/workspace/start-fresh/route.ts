import { NextResponse } from "next/server";
import { AppError, validationError } from "@/server/data/errors";
import { startFreshWorkspace } from "@/server/data/repositories";

export async function POST(request: Request) {
  try {
    const result = await startFreshWorkspace(await request.json());
    return NextResponse.json(result);
  } catch (error) {
    const normalized = validationError(error);
    if (normalized instanceof AppError) {
      return NextResponse.json(
        {
          ok: false,
          code:
            normalized.status === 422 ? "START_FRESH_CONFIRMATION_INVALID" : "START_FRESH_FAILED",
          message:
            normalized.status === 422
              ? normalized.message
              : "Fresh workspace could not be created.",
          details: normalized.status === 422 ? undefined : normalized.message,
          issues: normalized.issues,
        },
        { status: normalized.status },
      );
    }
    console.error("Start fresh failed", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        ok: false,
        code: "START_FRESH_FAILED",
        message: "Fresh workspace could not be created.",
        details: "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
