import { reconcileAccount } from "@/server/data/account-balances";
import { jsonError } from "@/server/data/errors";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    return Response.json({
      account: await reconcileAccount((await context.params).id, await request.json()),
    });
  } catch (error) {
    return jsonError(error);
  }
}
