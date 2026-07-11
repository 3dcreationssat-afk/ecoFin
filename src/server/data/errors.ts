import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly issues: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export function validationError(error: unknown) {
  if (error instanceof ZodError) {
    return new AppError(
      "Validation failed.",
      422,
      error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
    );
  }
  if (error instanceof SyntaxError) {
    return new AppError("Invalid JSON request body.", 400);
  }
  return error;
}

export function jsonError(error: unknown) {
  const normalized = validationError(error);
  if (normalized instanceof AppError) {
    return Response.json(
      { error: normalized.message, issues: normalized.issues },
      { status: normalized.status },
    );
  }
  console.error(error);
  return Response.json({ error: "Unexpected server error." }, { status: 500 });
}
