import "server-only";

type PlaidErrorShape = {
  response?: { data?: { error_code?: unknown; display_message?: unknown; error_type?: unknown } };
};

function bounded(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 240) : fallback;
}

export function safePlaidError(error: unknown) {
  const data = (error as PlaidErrorShape)?.response?.data;
  return {
    code: bounded(data?.error_code, "PLAID_REQUEST_FAILED"),
    type: bounded(data?.error_type, "API_ERROR"),
    message: bounded(
      data?.display_message,
      "The financial institution request could not be completed.",
    ),
  };
}
