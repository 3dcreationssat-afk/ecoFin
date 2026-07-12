import { updateSavedView } from "@/server/data/transaction-views";
import { jsonError } from "@/server/data/errors";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return Response.json({
      view: await updateSavedView((await context.params).id, await request.json()),
    });
  } catch (error) {
    return jsonError(error);
  }
}
