import { createSavedView, listSavedViews } from "@/server/data/transaction-views";
import { jsonError } from "@/server/data/errors";

export async function GET() {
  return Response.json({ views: await listSavedViews() });
}
export async function POST(request: Request) {
  try {
    return Response.json({ view: await createSavedView(await request.json()) }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
